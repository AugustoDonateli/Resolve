-- Polimento P8: o que a conta revela sobre o próprio jeito de estudar.
-- study_habits(): tempo típico por questão em cada área (mediana do tempo ativo, nas certas e nas erradas) e acerto
-- por período do dia, no fuso do perfil. Primeira tentativa, sem ajuda, últimos 90 dias.
-- my_weeks(): as últimas semanas (segunda a domingo, horário de Brasília): minutos pela regra tempo-v1, respostas,
-- acertos e dias com estudo. Só somas da própria conta.
create function public.study_habits() returns jsonb
language sql stable security definer set search_path = '' as $$
  with tz as (select coalesce((select p.timezone from public.profiles p where p.user_id = auth.uid()), 'America/Sao_Paulo') as z),
  a as (
    select ar.code as area, at.is_correct, at.active_ms,
           extract(hour from at.submitted_at at time zone (select z from tz))::int as h
      from public.attempts at
      join public.item_versions iv on iv.id = at.item_version_id
      join public.areas ar on ar.id = iv.area_id
     where at.user_id = auth.uid() and not at.is_repeat and not at.help_seen and at.is_correct is not null
       and at.submitted_at > now() - interval '90 days'
  ),
  timed as (select * from a where active_ms between 3000 and 900000),
  areas as (
    select area, count(*) as n,
           round(percentile_cont(0.5) within group (order by active_ms))::int as median_ms,
           count(*) filter (where is_correct) as n_correct,
           round(percentile_cont(0.5) within group (order by active_ms) filter (where is_correct))::int as median_ms_correct,
           count(*) filter (where not is_correct) as n_wrong,
           round(percentile_cont(0.5) within group (order by active_ms) filter (where not is_correct))::int as median_ms_wrong
      from timed group by area
  ),
  periods as (
    select case when h < 5 then 'madrugada' when h < 12 then 'manha' when h < 18 then 'tarde' else 'noite' end as period,
           count(*) as n, count(*) filter (where is_correct) as correct
      from a group by 1
  )
  select case when auth.uid() is null then null else jsonb_build_object(
    'areas', (select coalesce(jsonb_agg(to_jsonb(areas)), '[]'::jsonb) from areas),
    'overall_median_ms', (select round(percentile_cont(0.5) within group (order by active_ms))::int from timed),
    'timed', (select count(*) from timed),
    'periods', (select coalesce(jsonb_agg(to_jsonb(periods)), '[]'::jsonb) from periods)
  ) end;
$$;
revoke all on function public.study_habits() from public, anon;
grant execute on function public.study_habits() to authenticated;

create function public.my_weeks(p_weeks integer default 8) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null else (
    select coalesce(jsonb_agg(jsonb_build_object(
             'week_start', (w.s at time zone 'America/Sao_Paulo')::date,
             'minutes', private.study_seconds(auth.uid(), w.s, w.s + interval '7 days') / 60,
             'answers', (select count(*) from public.attempts a where a.user_id = auth.uid() and a.submitted_at >= w.s and a.submitted_at < w.s + interval '7 days'),
             'correct', (select count(*) from public.attempts a where a.user_id = auth.uid() and a.is_correct and a.submitted_at >= w.s and a.submitted_at < w.s + interval '7 days'),
             'days_active', (select count(distinct (t at time zone 'America/Sao_Paulo')::date) from (
                select a.submitted_at as t from public.attempts a where a.user_id = auth.uid() and a.submitted_at >= w.s and a.submitted_at < w.s + interval '7 days'
                union all
                select fi.started_at from public.focus_intervals fi where fi.user_id = auth.uid() and fi.started_at >= w.s and fi.started_at < w.s + interval '7 days') d)
           ) order by w.s desc), '[]'::jsonb)
      from (select private.week_start(-i) as s from generate_series(0, least(greatest(coalesce(p_weeks, 8), 1), 12) - 1) i) w)
  end;
$$;
revoke all on function public.my_weeks(integer) from public, anon;
grant execute on function public.my_weeks(integer) to authenticated;
