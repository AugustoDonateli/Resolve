-- F2-T09 — Contrato de estruturação e fila de dúvidas.
-- 1) Última barreira: nenhum bloco de conteúdo (estímulo, comando, alternativa, resolução) pode
--    conter marcação HTML, esquema executável, caractere de controle ou de inversão de direção.
-- 2) Propostas (saída do extrator ou de IA) ficam em área de preparação, com fila de dúvidas.
--    Proposta só fica "valida" completa, segura e sem dúvida aberta; publicação continua exigindo
--    revisão editorial (F2-T13/T14).

create function private.text_is_safe(t text) returns boolean
language sql immutable set search_path = '' as $$
  select t is null or (
    t !~ '<\s*/?\s*[a-zA-Z!?][^>]*>'
    and t !~* '(javascript\s*:|vbscript\s*:|data\s*:\s*text/html|\mon[a-z]{3,}\s*=|&#x?0*3c;?|&lt;\s*script)'
    and t !~ '[‪-‮⁦-⁩‎‏]'
    and t !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'
  );
$$;

-- Blocos: lista de objetos {id, type, text?, asset_ref?} com tipos e chaves conhecidos e texto seguro.
create function private.blocks_are_safe(b jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(b) = 'array' and not exists (
    select 1 from jsonb_array_elements(b) e
    where jsonb_typeof(e) <> 'object'
       or not (e ? 'id')
       or (e->>'id') !~ '^[a-z0-9_-]{1,24}$'
       or exists (select 1 from jsonb_object_keys(e) k where k not in ('id', 'type', 'text', 'asset_ref', 'asset_id'))
       or (e ? 'type' and (e->>'type') not in ('paragraph', 'heading', 'source', 'image', 'table', 'formula'))
       or not private.text_is_safe(e->>'text')
  );
$$;

alter table public.stimulus_versions add constraint stimulus_blocks_safe check (private.blocks_are_safe(blocks_json));
alter table public.item_versions add constraint command_blocks_safe check (private.blocks_are_safe(command_blocks));
alter table public.item_versions add constraint explanation_steps_safe check (private.blocks_are_safe(explanation_steps));
alter table public.alternatives add constraint alternative_blocks_safe check (private.blocks_are_safe(content_blocks));
alter table public.evidence_annotations add constraint evidence_rationale_safe check (private.text_is_safe(rationale));
alter table public.alternative_annotations add constraint alternative_rationale_safe check (private.text_is_safe(rationale));

-- Proposta completa segundo o contrato item-proposal/v1 (o validador local faz a checagem completa).
create function private.proposal_is_complete(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select p->>'contract' = 'item-proposal/v1'
     and (p->>'number') ~ '^\d{1,3}$' and (p->>'number')::int between 1 and 180
     and p->>'area' in ('LC', 'MT', 'CN', 'CH')
     and jsonb_typeof(p->'command_blocks') = 'array' and jsonb_array_length(p->'command_blocks') > 0
     and exists (select 1 from jsonb_array_elements(p->'command_blocks') c where length(trim(coalesce(c->>'text', ''))) > 0)
     and private.blocks_are_safe(coalesce(p->'stimulus_blocks', '[]'::jsonb))
     and private.blocks_are_safe(p->'command_blocks')
     and (select bool_and(
            jsonb_typeof(p->'alternatives'->k) = 'array'
            and jsonb_array_length(p->'alternatives'->k) > 0
            and private.blocks_are_safe(p->'alternatives'->k)
            and exists (select 1 from jsonb_array_elements(p->'alternatives'->k) a
                        where a->>'type' = 'image' or length(trim(coalesce(a->>'text', ''))) > 0))
          from unnest(array['A', 'B', 'C', 'D', 'E']) k)
     and p->'producer'->>'kind' in ('extrator', 'modelo')
     and (p->'producer'->>'kind' <> 'modelo' or (p->'producer' ? 'model' and p->'producer' ? 'prompt_version'));
$$;

create table public.ingest_batches (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id),
  tool text not null,
  tool_version text not null,
  contract_version text not null default 'item-proposal/v1',
  notes text,
  created_at timestamptz not null default now()
);

create table public.item_proposals (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.ingest_batches (id) on delete cascade,
  question_number smallint not null check (question_number between 1 and 180),
  foreign_language text check (foreign_language in ('ingles', 'espanhol')),
  payload jsonb not null,
  status text not null check (status in ('valida', 'duvida', 'rejeitada', 'promovida')),
  validation jsonb not null default '{}'::jsonb,
  promoted_item_version_id uuid references public.item_versions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index item_proposals_unique on public.item_proposals (batch_id, question_number, coalesce(foreign_language, '-'));

create table public.doubt_queue (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.item_proposals (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 400),
  status text not null default 'aberta' check (status in ('aberta', 'resolvida', 'descartada')),
  resolution text check (char_length(resolution) <= 2000),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'aberta') = (resolved_at is null)),
  check (status = 'aberta' or char_length(coalesce(resolution, '')) >= 3)
);

create function private.guard_proposal() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status in ('valida', 'promovida') then
    if not private.proposal_is_complete(new.payload) then
      raise exception 'resolve_proposal_incomplete' using errcode = 'P0001',
        hint = 'Proposta incompleta ou com conteúdo inseguro não pode ser marcada como válida.';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.doubt_queue d where d.proposal_id = new.id and d.status = 'aberta') then
      raise exception 'resolve_proposal_has_open_doubts' using errcode = 'P0001';
    end if;
  end if;
  if new.status = 'promovida' and (tg_op = 'INSERT' or old.status <> 'valida' or new.promoted_item_version_id is null) then
    raise exception 'resolve_proposal_promotion_invalid' using errcode = 'P0001',
      hint = 'Só proposta válida promovida a uma versão de item.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'promovida' then
    raise exception 'resolve_proposal_promoted_immutable' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger item_proposals_guard before insert or update on public.item_proposals
  for each row execute function private.guard_proposal();

-- Dúvida aberta em proposta válida a rebaixa para "duvida".
create function private.doubt_reopens_proposal() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'aberta' then
    update public.item_proposals set status = 'duvida' where id = new.proposal_id and status = 'valida';
  end if;
  return new;
end;
$$;
create trigger doubt_queue_reopen after insert or update on public.doubt_queue
  for each row execute function private.doubt_reopens_proposal();

alter table public.ingest_batches enable row level security;
alter table public.item_proposals enable row level security;
alter table public.doubt_queue enable row level security;
revoke all on public.ingest_batches, public.item_proposals, public.doubt_queue from anon, authenticated;
-- Sem políticas: área editorial. O papel de editor entra na F2-T05.

create index ingest_batches_source on public.ingest_batches (source_id);
create index item_proposals_batch on public.item_proposals (batch_id);
create index item_proposals_promoted on public.item_proposals (promoted_item_version_id);
create index doubt_queue_proposal on public.doubt_queue (proposal_id);
create index doubt_queue_resolved_by on public.doubt_queue (resolved_by);
create index doubt_queue_open on public.doubt_queue (status) where status = 'aberta';

revoke all on all functions in schema private from public, anon, authenticated;
