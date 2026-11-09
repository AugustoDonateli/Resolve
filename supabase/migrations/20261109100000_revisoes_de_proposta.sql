-- F2-T12 — Revisão editorial de conteúdo com histórico preservado.
-- Cada correção do editor é uma revisão nova e imutável; a revisão 0 é a extração original.
-- O conteúdo da proposta só muda junto com uma revisão (o banco recusa alteração sem histórico).

alter table public.item_proposals add column current_revision integer not null default 0 check (current_revision >= 0);

create table public.item_proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.item_proposals (id) on delete cascade,
  revision integer not null check (revision >= 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and private.json_strings_are_safe(payload)),
  note text not null check (char_length(note) between 3 and 1000 and private.text_is_safe(note)),
  changed text[] not null default '{}' check (cardinality(changed) <= 60),
  edited_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  unique (proposal_id, revision)
);

create function private.revision_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'resolve_revision_immutable' using errcode = 'P0001', hint = 'Revisão registrada não muda nem some.';
end;
$$;
create trigger item_proposal_revisions_immutable before update or delete on public.item_proposal_revisions
  for each row execute function private.revision_immutable();

-- Revisão 0 nasce com a proposta.
create function private.proposal_first_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.item_proposal_revisions (proposal_id, revision, payload, note)
  values (new.id, 0, new.payload, 'Extração original (' || coalesce(new.payload->'producer'->>'tool', 'importador') || ')');
  return new;
end;
$$;
create trigger item_proposals_first_revision after insert on public.item_proposals
  for each row execute function private.proposal_first_revision();

-- Conteúdo só muda com revisão registrada de mesmo número e mesmo conteúdo.
create function private.proposal_revision_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.payload is distinct from old.payload or new.current_revision <> old.current_revision then
    if new.current_revision <> old.current_revision + 1 or not exists (
      select 1 from public.item_proposal_revisions r
      where r.proposal_id = new.id and r.revision = new.current_revision and r.payload = new.payload
    ) then
      raise exception 'resolve_proposal_needs_revision' using errcode = 'P0001',
        hint = 'Use revise_proposal: toda correção fica no histórico.';
    end if;
  end if;
  return new;
end;
$$;
create trigger item_proposals_revision_guard before update on public.item_proposals
  for each row execute function private.proposal_revision_guard();

-- Correção do editor. Invocador: as políticas de editor valem aqui.
create function public.revise_proposal(p_id uuid, p_expected_revision integer, p_payload jsonb, p_note text, p_changed text[] default '{}')
returns table (revision integer, status text)
language plpgsql security invoker set search_path = '' as $$
declare
  v_old public.item_proposals%rowtype;
  v_status text;
begin
  select * into v_old from public.item_proposals where id = p_id for update;
  if not found then
    raise exception 'resolve_proposal_not_found' using errcode = 'P0001';
  end if;
  if v_old.status = 'promovida' then
    raise exception 'resolve_proposal_promoted_immutable' using errcode = 'P0001';
  end if;
  if v_old.current_revision <> p_expected_revision then
    raise exception 'resolve_revision_conflict' using errcode = 'P0001',
      hint = format('A proposta está na revisão %s; recarregue antes de salvar.', v_old.current_revision);
  end if;
  -- O editor corrige conteúdo; identidade e origem da questão não mudam.
  if p_payload->'source' is distinct from v_old.payload->'source'
     or p_payload->'number' is distinct from v_old.payload->'number'
     or p_payload->'foreign_language' is distinct from v_old.payload->'foreign_language'
     or p_payload->'area' is distinct from v_old.payload->'area'
     or p_payload->'contract' is distinct from v_old.payload->'contract' then
    raise exception 'resolve_proposal_identity_changed' using errcode = 'P0001';
  end if;

  insert into public.item_proposal_revisions (proposal_id, revision, payload, note, changed)
  values (p_id, v_old.current_revision + 1, p_payload, p_note, coalesce(p_changed, '{}'));

  v_status := case
    when private.proposal_is_complete(p_payload)
         and not exists (select 1 from public.doubt_queue d where d.proposal_id = p_id and d.status = 'aberta') then 'valida'
    else 'duvida' end;
  update public.item_proposals
     set payload = p_payload, current_revision = v_old.current_revision + 1, status = v_status
   where id = p_id;
  return query select v_old.current_revision + 1, v_status;
end;
$$;
revoke all on function public.revise_proposal(uuid, integer, jsonb, text, text[]) from public, anon;
grant execute on function public.revise_proposal(uuid, integer, jsonb, text, text[]) to authenticated;

-- Depois de resolver dúvidas: proposta completa e sem dúvida aberta volta a "valida".
create function public.refresh_proposal_status(p_id uuid) returns text
language plpgsql security invoker set search_path = '' as $$
declare
  v_status text;
begin
  update public.item_proposals p
     set status = case
       when private.proposal_is_complete(p.payload)
            and not exists (select 1 from public.doubt_queue d where d.proposal_id = p.id and d.status = 'aberta') then 'valida'
       else 'duvida' end
   where p.id = p_id and p.status in ('valida', 'duvida')
  returning p.status into v_status;
  return v_status;
end;
$$;
revoke all on function public.refresh_proposal_status(uuid) from public, anon;
grant execute on function public.refresh_proposal_status(uuid) to authenticated;

alter table public.item_proposal_revisions enable row level security;
revoke all on public.item_proposal_revisions from anon, authenticated;
grant select, insert on public.item_proposal_revisions to authenticated;
create policy "editor: histórico" on public.item_proposal_revisions for select to authenticated using ((select public.is_editor()));
create policy "editor: registrar revisão" on public.item_proposal_revisions for insert to authenticated
  with check ((select public.is_editor()) and edited_by is not distinct from (select auth.uid()));

create index item_proposal_revisions_edited_by on public.item_proposal_revisions (edited_by);

-- Revisões já existentes: propostas anteriores a esta migração ganham a revisão 0.
insert into public.item_proposal_revisions (proposal_id, revision, payload, note, edited_by)
select p.id, 0, p.payload, 'Extração original (anterior ao histórico)', null from public.item_proposals p
on conflict do nothing;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.text_is_safe(text) to authenticated;
grant execute on function private.blocks_are_safe(jsonb) to authenticated;
grant execute on function private.json_strings_are_safe(jsonb) to authenticated;
grant execute on function private.proposal_is_complete(jsonb) to authenticated;
