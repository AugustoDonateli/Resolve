-- F3-T17 — Informação de problema. Critério: relato preserva item/versão e não publica mudança sem revisão.
-- O aluno relata um problema numa versão publicada; o relato fica ligado à versão exata e não muda depois.
-- O editor lê, analisa e fecha (com nota). Nenhuma ocorrência altera conteúdo: correção segue o fluxo
-- editorial normal (nova revisão, aprovação e publicação).
create table public.item_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_version_id uuid not null references public.item_versions (id),
  session_item_id uuid references public.session_items (id) on delete set null,
  kind text not null check (kind in ('texto_diferente_da_prova', 'figura', 'alternativas', 'gabarito', 'resolucao', 'outro')),
  message text not null check (char_length(trim(message)) between 5 and 1000 and private.text_is_safe(message)),
  status text not null default 'aberta' check (status in ('aberta', 'em_analise', 'resolvida', 'descartada')),
  editor_note text check (char_length(editor_note) <= 1000 and private.text_is_safe(editor_note)),
  handled_by uuid references auth.users (id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status in ('resolvida', 'descartada')) = (handled_at is not null))
);

create function private.guard_item_report() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'aberta' or new.editor_note is not null or new.handled_by is not null or new.handled_at is not null then
      raise exception 'resolve_report_invalid' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.item_versions iv where iv.id = new.item_version_id and iv.review_status = 'published') then
      raise exception 'resolve_item_unavailable' using errcode = 'P0001';
    end if;
    if new.session_item_id is not null and not exists (
         select 1 from public.session_items si join public.study_sessions s on s.id = si.session_id
          where si.id = new.session_item_id and si.item_version_id = new.item_version_id and s.user_id = new.user_id) then
      raise exception 'resolve_session_item_not_found' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- Atualização: só editor, e o relato em si (quem, versão, tipo, texto, data) não muda.
  if not public.is_editor() then
    raise exception 'resolve_not_editor' using errcode = 'P0001';
  end if;
  if (new.user_id, new.item_version_id, new.session_item_id, new.kind, new.message, new.created_at)
     is distinct from (old.user_id, old.item_version_id, old.session_item_id, old.kind, old.message, old.created_at) then
    raise exception 'resolve_report_immutable' using errcode = 'P0001';
  end if;
  new.handled_by := auth.uid();
  new.handled_at := case when new.status in ('resolvida', 'descartada') then coalesce(old.handled_at, now()) else null end;
  return new;
end;
$$;
create trigger item_reports_guard before insert or update on public.item_reports
  for each row execute function private.guard_item_report();

alter table public.item_reports enable row level security;
revoke all on public.item_reports from anon, authenticated;
grant select, insert on public.item_reports to authenticated;
grant update (status, editor_note) on public.item_reports to authenticated;
create policy "ocorrências: as próprias ou editor" on public.item_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_editor()));
create policy "ocorrências: aluno relata" on public.item_reports for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "ocorrências: editor analisa" on public.item_reports for update to authenticated
  using ((select public.is_editor())) with check ((select public.is_editor()));
create index item_reports_version on public.item_reports (item_version_id);
create index item_reports_user on public.item_reports (user_id);
create index item_reports_open on public.item_reports (created_at) where status in ('aberta', 'em_analise');
create index item_reports_session_item on public.item_reports (session_item_id);
create index item_reports_handled_by on public.item_reports (handled_by);
revoke all on function private.guard_item_report() from public, anon, authenticated;
