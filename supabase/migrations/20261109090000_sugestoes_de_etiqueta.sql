-- F2-T11 — Sugestões de etiqueta (habilidade, dependência, evidências, distratores) feitas por modelo.
-- Toda sugestão guarda provedor, modelo, versão e hash do prompt; incerteza obriga "pendente".
-- Sugestão não é etiqueta: a revisão editorial (F2-T13) decide o que vira item_skill_tags etc.

create function private.json_strings_are_safe(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select not exists (
    select 1 from jsonb_path_query(p, 'strict $.**') v
    where jsonb_typeof(v) = 'string' and not private.text_is_safe(v #>> '{}')
  );
$$;

create table public.tag_suggestions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.item_proposals (id) on delete cascade,
  status text not null check (status in ('sugerida', 'pendente')),
  uncertainties text[] not null default '{}',
  suggestion jsonb not null check (jsonb_typeof(suggestion) = 'object' and private.json_strings_are_safe(suggestion)),
  provider text not null check (provider in ('anthropic')),
  model_requested text not null check (model_requested ~ '^[a-z0-9.-]{3,64}$'),
  model_served text check (model_served ~ '^[a-z0-9.-]{3,64}$'),
  fallback_ran boolean not null default false,
  prompt_version text not null check (prompt_version ~ '^[a-z0-9._-]{1,40}$'),
  prompt_sha256 text not null check (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  schema_version text not null check (schema_version = 'tag-suggestion/v1'),
  taxonomy_version text not null,
  request_id text check (char_length(request_id) <= 200),
  stop_reason text check (char_length(stop_reason) <= 40),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  -- "sugerida" só sem nenhuma incerteza e com o modelo que respondeu registrado
  check (status = 'pendente' or (cardinality(uncertainties) = 0 and model_served is not null)),
  check (private.json_strings_are_safe(to_jsonb(uncertainties)))
);

-- Registro imutável: nova rodada = nova linha.
create function private.tag_suggestion_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'resolve_tag_suggestion_immutable' using errcode = 'P0001',
    hint = 'Sugestão registrada não muda; rode de novo para obter outra.';
end;
$$;
create trigger tag_suggestions_immutable before update on public.tag_suggestions
  for each row execute function private.tag_suggestion_immutable();

alter table public.tag_suggestions enable row level security;
revoke all on public.tag_suggestions from anon, authenticated;
grant select, insert on public.tag_suggestions to authenticated;
create policy "editor: sugestões" on public.tag_suggestions for select to authenticated using ((select public.is_editor()));
create policy "editor: registrar sugestão" on public.tag_suggestions for insert to authenticated
  with check ((select public.is_editor()) and created_by = (select auth.uid()));

create index tag_suggestions_proposal on public.tag_suggestions (proposal_id);
create index tag_suggestions_created_by on public.tag_suggestions (created_by);
create index tag_suggestions_pending on public.tag_suggestions (status) where status = 'pendente';

revoke all on all functions in schema private from public, anon, authenticated;
