-- TRI e dados do Inep (sessão 1 do plano v2).
--
-- 1) Um modelo de TRI pode reunir conjuntos de parâmetros de mais de uma edição. Os parâmetros do Inep de
--    edições diferentes estão na mesma escala do Enem (a validação contra as notas oficiais confere isso ano a
--    ano). O conjunto principal continua em tri_model_versions.parameter_set_id; os demais entram em
--    tri_model_parameter_sets, sempre da mesma área e com a mesma constante D.
-- 2) Taxa de acerto real por questão, dos microdados, com fonte e população descritas.

create table public.tri_model_parameter_sets (
  model_id text not null references public.tri_model_versions (id),
  parameter_set_id uuid not null references public.parameter_sets (id),
  primary key (model_id, parameter_set_id)
);
create index tri_model_parameter_sets_set on public.tri_model_parameter_sets (parameter_set_id);

create function public.tri_model_set_check() returns trigger
language plpgsql set search_path = '' as $$
declare ok boolean;
begin
  select ps.area_id = pp.area_id and ps.scale_constant = pp.scale_constant into ok
  from public.tri_model_versions mv
  join public.parameter_sets pp on pp.id = mv.parameter_set_id
  join public.parameter_sets ps on ps.id = new.parameter_set_id
  where mv.id = new.model_id;
  if not coalesce(ok, false) then
    raise exception 'conjunto de parâmetros de outra área ou com outra constante D';
  end if;
  return new;
end $$;
create trigger tri_model_set_check before insert or update on public.tri_model_parameter_sets
  for each row execute function public.tri_model_set_check();

alter table public.tri_model_parameter_sets enable row level security;
revoke all on public.tri_model_parameter_sets from anon;
grant select, insert on public.tri_model_parameter_sets to authenticated;
create policy "modelo TRI (conjuntos): contas leem" on public.tri_model_parameter_sets for select to authenticated using (true);
create policy "modelo TRI (conjuntos): editor grava" on public.tri_model_parameter_sets for insert to authenticated with check ((select public.is_editor()));

-- As demais tabelas da TRI também não precisam de nenhum acesso de visitante.
revoke all on public.parameter_sets, public.item_parameters, public.tri_model_versions from anon;

-- Respostas que entram na estimativa: as mesmas regras de antes; o parâmetro vem de qualquer conjunto do modelo.
create or replace function public.tri_responses(p_area text, p_model text)
returns table (item_id uuid, attempt_id uuid, is_correct boolean, submitted_at timestamptz, a numeric, b numeric, c numeric, valid boolean)
language sql stable security definer set search_path = '' as $$
  select distinct on (t.item_id) t.item_id, t.id, t.is_correct, t.submitted_at, ip.a, ip.b, ip.c, coalesce(ip.valid, false)
  from public.attempts t
  join public.item_versions iv on iv.id = t.item_version_id
  join public.areas ar on ar.id = iv.area_id
  left join lateral (
    select x.a, x.b, x.c, x.valid
    from public.item_parameters x
    where x.item_id = t.item_id
      and x.parameter_set_id in (
        select mv.parameter_set_id from public.tri_model_versions mv where mv.id = p_model
        union
        select ms.parameter_set_id from public.tri_model_parameter_sets ms where ms.model_id = p_model)
    order by x.valid desc
    limit 1
  ) ip on true
  where t.user_id = auth.uid() and ar.code = p_area and not t.help_seen and not t.is_repeat and not iv.annulled
  order by t.item_id, t.submitted_at;
$$;
revoke all on function public.tri_responses(text, text) from public, anon;
grant execute on function public.tri_responses(text, text) to authenticated;

create table public.item_response_stats (
  item_id uuid not null references public.items (id),
  source_id uuid not null references public.sources (id),
  -- quem entra na conta, em palavras (ex.: presentes da aplicação regular, versões não adaptadas)
  population text not null check (char_length(population) between 3 and 400),
  respondents integer not null check (respondents > 0),
  correct integer not null check (correct between 0 and respondents),
  blank integer not null check (blank between 0 and respondents),
  -- marcações por alternativa (letra estável), só dos cadernos com mapa de letras conferido
  alternatives jsonb check (alternatives is null or jsonb_typeof(alternatives) = 'object'),
  alternatives_respondents integer check (alternatives_respondents is null or alternatives_respondents > 0),
  note text check (char_length(note) <= 600),
  created_at timestamptz not null default now(),
  primary key (item_id, source_id),
  check ((alternatives is null) = (alternatives_respondents is null))
);
create index item_response_stats_source on public.item_response_stats (source_id);

alter table public.item_response_stats enable row level security;
revoke all on public.item_response_stats from anon;
grant select, insert, update on public.item_response_stats to authenticated;
create policy "taxas de acerto: contas leem" on public.item_response_stats for select to authenticated using (true);
create policy "taxas de acerto: editor grava" on public.item_response_stats for insert to authenticated with check ((select public.is_editor()));
create policy "taxas de acerto: editor altera" on public.item_response_stats for update to authenticated using ((select public.is_editor()));
