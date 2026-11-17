-- Tempo de estudo automático (pedido de Guto, 17/11): o site guarda sozinho o tempo em que a pessoa está estudando
-- nele (questões, revisão, redação, simulado, diagnóstico), e não só o foco e o tempo de cada questão.
-- O navegador avisa a cada 30 s enquanto a pessoa está na página e mexeu nela nos últimos 3 minutos; o banco estende
-- o período aberto (no máximo 2 minutos de cada vez) ou abre outro. Ninguém digita horas.
-- No grupo, todo mundo entra no ranking de tempo por padrão; quem preferir pode sair (share_time = false).

create table public.study_presence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('questoes', 'revisao', 'redacao', 'simulado', 'diagnostico')),
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  check (last_at >= started_at)
);
create index study_presence_user_last on public.study_presence (user_id, last_at desc);
alter table public.study_presence enable row level security;
revoke all on public.study_presence from anon, authenticated;

create function public.ping_study(p_kind text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_last timestamptz;
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  if p_kind not in ('questoes', 'revisao', 'redacao', 'simulado', 'diagnostico') then
    raise exception 'resolve_presence_kind' using errcode = 'P0001';
  end if;
  select id, last_at into v_id, v_last from public.study_presence where user_id = auth.uid() order by last_at desc limit 1;
  if v_id is not null and v_last > now() - interval '2 minutes' then
    if v_last > now() - interval '15 seconds' then
      return; -- aviso repetido em pouco tempo: nada a somar
    end if;
    update public.study_presence set last_at = now() where id = v_id;
  else
    insert into public.study_presence (user_id, kind) values (auth.uid(), p_kind);
  end if;
end $$;
revoke all on function public.ping_study(text) from public, anon;
grant execute on function public.ping_study(text) to authenticated;

-- Regra tempo-v2: une foco, tempo ativo nas questões e presença nas páginas de estudo (o que se sobrepõe conta uma vez).
create or replace function private.study_seconds(p_user uuid, p_from timestamptz, p_to timestamptz) returns integer
language sql stable security definer set search_path = '' as $$
  with r as (
    select tstzrange(fi.started_at, least(coalesce(fi.ended_at, now()), fi.started_at + interval '3 hours')) as rg
      from public.focus_intervals fi
     where fi.user_id = p_user and fi.started_at < p_to and coalesce(fi.ended_at, now()) > p_from
    union all
    select tstzrange(a.submitted_at - make_interval(secs => least(a.active_ms, 900000) / 1000.0), a.submitted_at)
      from public.attempts a
     where a.user_id = p_user and a.submitted_at >= p_from and a.submitted_at < p_to + interval '15 minutes' and a.active_ms > 0
    union all
    select tstzrange(sp.started_at, sp.last_at)
      from public.study_presence sp
     where sp.user_id = p_user and sp.started_at < p_to and sp.last_at > p_from
  ),
  u as (select coalesce(range_agg(rg), '{}'::tstzmultirange) as m from r where not isempty(rg)),
  days as (select d as s, d + interval '1 day' as e from generate_series(p_from, p_to - interval '1 second', interval '1 day') d)
  select coalesce(sum(least(43200, (
           select coalesce(sum(extract(epoch from upper(x) - lower(x))), 0)
             from unnest(u.m * tstzmultirange(tstzrange(days.s, least(days.e, p_to)))) x))), 0)::integer
    from days cross join u;
$$;

-- Dias com estudo e "estudando agora" passam a contar também a presença.
create function private.study_days(p_user uuid, p_from timestamptz, p_to timestamptz) returns integer
language sql stable security definer set search_path = '' as $$
  select count(distinct (t at time zone 'America/Sao_Paulo')::date)::int from (
    select a.submitted_at as t from public.attempts a where a.user_id = p_user and a.submitted_at >= p_from and a.submitted_at < p_to
    union all
    select fi.started_at from public.focus_intervals fi where fi.user_id = p_user and fi.started_at >= p_from and fi.started_at < p_to
    union all
    select sp.started_at from public.study_presence sp where sp.user_id = p_user and sp.started_at >= p_from and sp.started_at < p_to
  ) d;
$$;
create function private.studying_now(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.focus_intervals fi where fi.user_id = p_user and fi.ended_at is null and fi.started_at > now() - interval '3 hours')
      or exists (select 1 from public.attempts a where a.user_id = p_user and a.submitted_at > now() - interval '5 minutes')
      or exists (select 1 from public.study_presence sp where sp.user_id = p_user and sp.last_at > now() - interval '3 minutes');
$$;
revoke all on function private.study_days(uuid, timestamptz, timestamptz), private.studying_now(uuid) from public, anon, authenticated;

create or replace function public.group_week_board(p_group uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_start timestamptz := private.week_start();
  v_end timestamptz := v_start + interval '7 days';
  v_prev timestamptz := v_start - interval '7 days';
  v_week date := (v_start at time zone 'America/Sao_Paulo')::date;
  v_rows jsonb;
begin
  if auth.uid() is null or not (select private.is_group_member(p_group)) then
    return null;
  end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.minutes desc nulls last, x.nickname), '[]'::jsonb) into v_rows
  from (
    select m.nickname, m.user_id = auth.uid() as me, m.share_time as sharing,
           case when m.share_time then m.user_id end as user_id,
           case when m.share_time or m.user_id = auth.uid() then private.study_seconds(m.user_id, v_start, v_end) / 60 end as minutes,
           case when m.share_time or m.user_id = auth.uid() then private.study_seconds(m.user_id, v_prev, v_start) / 60 end as previous_minutes,
           case when m.share_time or m.user_id = auth.uid() then
             (select count(*) from public.attempts a where a.user_id = m.user_id and a.submitted_at >= v_start and a.submitted_at < v_end) end as questions,
           case when m.share_time or m.user_id = auth.uid() then private.study_days(m.user_id, v_start, v_end) end as days_active,
           case when m.share_time then private.studying_now(m.user_id) end as studying_now,
           case when m.share_time then
             (select count(*) from public.group_applause ga where ga.group_id = p_group and ga.week_start = v_week and ga.to_user = m.user_id) end as applause,
           case when m.share_time then
             exists (select 1 from public.group_applause ga where ga.group_id = p_group and ga.week_start = v_week and ga.to_user = m.user_id and ga.from_user = auth.uid()) end as applauded_by_me
      from public.study_group_members m
     where m.group_id = p_group and m.left_at is null
  ) x;
  return jsonb_build_object(
    'week_start', v_week,
    'goal_minutes', (select g.weekly_goal_minutes from public.study_groups g where g.id = p_group),
    'total_minutes', (select coalesce(sum((r->>'minutes')::int), 0) from jsonb_array_elements(v_rows) r where (r->>'sharing')::boolean),
    'members', v_rows,
    'time_duels', private.time_duels_of(p_group, v_start));
end $$;

create or replace function public.my_weeks(p_weeks integer default 8) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null else (
    select coalesce(jsonb_agg(jsonb_build_object(
             'week_start', (w.s at time zone 'America/Sao_Paulo')::date,
             'minutes', private.study_seconds(auth.uid(), w.s, w.s + interval '7 days') / 60,
             'answers', (select count(*) from public.attempts a where a.user_id = auth.uid() and a.submitted_at >= w.s and a.submitted_at < w.s + interval '7 days'),
             'correct', (select count(*) from public.attempts a where a.user_id = auth.uid() and a.is_correct and a.submitted_at >= w.s and a.submitted_at < w.s + interval '7 days'),
             'days_active', private.study_days(auth.uid(), w.s, w.s + interval '7 days')
           ) order by w.s desc), '[]'::jsonb)
      from (select private.week_start(-i) as s from generate_series(0, least(greatest(coalesce(p_weeks, 8), 1), 12) - 1) i) w)
  end;
$$;

-- No grupo, o ranking de tempo é a disputa: todo mundo entra por padrão e pode sair quando quiser.
alter table public.study_group_members alter column share_time set default true;
update public.study_group_members set share_time = true where left_at is null and not share_time;
