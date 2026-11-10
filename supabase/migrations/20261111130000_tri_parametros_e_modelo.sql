-- TRI: conjuntos de parâmetros com fonte, parâmetros por item e versões do modelo (configuração do cálculo).
-- Nada é carregado aqui: parâmetros só entram com fonte oficial registrada (microdados do Inep). Ausência de
-- parâmetro nunca vira zero; o item fica fora do cálculo. O cálculo (EAP, 3PL) roda em código versionado
-- (apps/web/src/lib/tri/engine.ts) com a configuração registrada em tri_model_versions.

create table public.parameter_sets (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 3 and 160),
  source_id uuid not null references public.sources (id),
  application_id uuid references public.applications (id),
  area_id uuid not null references public.areas (id),
  model_family text not null check (model_family = '3pl'),
  scale_constant numeric not null check (scale_constant > 0),
  note text check (char_length(note) <= 1000),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index parameter_sets_area on public.parameter_sets (area_id);

create table public.item_parameters (
  parameter_set_id uuid not null references public.parameter_sets (id),
  item_id uuid not null references public.items (id),
  a numeric,
  b numeric,
  c numeric,
  valid boolean not null,
  exclusion_reason text check (char_length(exclusion_reason) <= 300),
  primary key (parameter_set_id, item_id),
  -- válido exige os três parâmetros no domínio do 3PL; inválido exige motivo
  check ((valid and a > 0 and b is not null and c >= 0 and c < 1 and exclusion_reason is null)
      or (not valid and exclusion_reason is not null))
);
create index item_parameters_item on public.item_parameters (item_id);

create table public.tri_model_versions (
  id text primary key check (id ~ '^[a-z0-9.-]{3,60}$'),
  parameter_set_id uuid not null references public.parameter_sets (id),
  prior_config jsonb not null check (prior_config->>'kind' = 'normal' and (prior_config->>'sd')::numeric > 0),
  integration_config jsonb not null check ((integration_config->>'points')::int >= 11
                                           and (integration_config->>'to')::numeric > (integration_config->>'from')::numeric),
  transform_config jsonb check (transform_config is null or (transform_config->>'slope')::numeric > 0),
  interval_z numeric not null check (interval_z > 0),
  transform_source text check (char_length(transform_source) <= 600),
  code_version text not null check (char_length(code_version) between 1 and 80),
  validation_status text not null default 'nao_validado' check (validation_status in ('nao_validado', 'em_validacao', 'validado', 'reprovado')),
  validation_note text check (char_length(validation_note) <= 2000),
  created_at timestamptz not null default now(),
  -- transformação para a escala de notas só com fonte registrada
  check (transform_config is null or transform_source is not null)
);
create index tri_model_versions_set on public.tri_model_versions (parameter_set_id);

alter table public.parameter_sets enable row level security;
alter table public.item_parameters enable row level security;
alter table public.tri_model_versions enable row level security;
grant select on public.parameter_sets, public.item_parameters, public.tri_model_versions to authenticated;
grant insert, update on public.parameter_sets, public.item_parameters, public.tri_model_versions to authenticated;
create policy "parâmetros: contas leem" on public.parameter_sets for select to authenticated using (true);
create policy "parâmetros: editor grava" on public.parameter_sets for insert to authenticated with check ((select public.is_editor()));
create policy "parâmetros: editor altera" on public.parameter_sets for update to authenticated using ((select public.is_editor()));
create policy "parâmetros por item: contas leem" on public.item_parameters for select to authenticated using (true);
create policy "parâmetros por item: editor grava" on public.item_parameters for insert to authenticated with check ((select public.is_editor()));
create policy "parâmetros por item: editor altera" on public.item_parameters for update to authenticated using ((select public.is_editor()));
create policy "modelo TRI: contas leem" on public.tri_model_versions for select to authenticated using (true);
create policy "modelo TRI: editor grava" on public.tri_model_versions for insert to authenticated with check ((select public.is_editor()));
create policy "modelo TRI: editor altera" on public.tri_model_versions for update to authenticated using ((select public.is_editor()));

-- Respostas que entram na estimativa da conta: primeira tentativa de cada item, sem ajuda e sem repetição,
-- de itens publicados da área. Devolve também o parâmetro do conjunto do modelo, quando houver.
create function public.tri_responses(p_area text, p_model text)
returns table (item_id uuid, attempt_id uuid, is_correct boolean, submitted_at timestamptz, a numeric, b numeric, c numeric, valid boolean)
language sql stable security definer set search_path = '' as $$
  select distinct on (t.item_id) t.item_id, t.id, t.is_correct, t.submitted_at, ip.a, ip.b, ip.c, coalesce(ip.valid, false)
  from public.attempts t
  join public.item_versions iv on iv.id = t.item_version_id
  join public.areas ar on ar.id = iv.area_id
  left join public.tri_model_versions mv on mv.id = p_model
  left join public.item_parameters ip on ip.parameter_set_id = mv.parameter_set_id and ip.item_id = t.item_id
  where t.user_id = auth.uid() and ar.code = p_area and not t.help_seen and not t.is_repeat and not iv.annulled
  order by t.item_id, t.submitted_at;
$$;
revoke all on function public.tri_responses(text, text) from public, anon;
grant execute on function public.tri_responses(text, text) to authenticated;
