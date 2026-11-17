-- Polimento P7: aplauso entre colegas, duelo de tempo da semana e resumo da semana passada.
-- Tudo vale só entre quem está no ranking de tempo do grupo (share_time): ninguém tem tempo exposto sem ter
-- escolhido aparecer. As tabelas só são lidas e escritas pelas funções.

create table public.group_applause (
  group_id uuid not null references public.study_groups (id) on delete cascade,
  week_start date not null,
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, week_start, from_user, to_user),
  check (from_user <> to_user)
);
alter table public.group_applause enable row level security;
revoke all on public.group_applause from anon, authenticated;

create table public.time_duels (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups (id) on delete cascade,
  week_start date not null,
  challenger uuid not null references auth.users (id) on delete cascade,
  opponent uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (challenger <> opponent)
);
create unique index time_duels_pair on public.time_duels (group_id, week_start, least(challenger, opponent), greatest(challenger, opponent));
alter table public.time_duels enable row level security;
revoke all on public.time_duels from anon, authenticated;

create function private.week_start(p_offset integer default 0) returns timestamptz
language sql stable set search_path = '' as $$
  select (date_trunc('week', now() at time zone 'America/Sao_Paulo') + make_interval(weeks => p_offset)) at time zone 'America/Sao_Paulo';
$$;

-- Os dois precisam estar no grupo e no ranking de tempo.
create function private.both_in_ranking(p_group uuid, p_other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_other <> auth.uid() and (select count(*) from public.study_group_members m
    where m.group_id = p_group and m.left_at is null and m.share_time and m.user_id in (auth.uid(), p_other)) = 2;
$$;

create function public.applaud_member(p_group uuid, p_to uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (select private.both_in_ranking(p_group, p_to)) then
    raise exception 'resolve_not_in_ranking' using errcode = 'P0001', hint = 'Vocês dois precisam estar no ranking de tempo do grupo.';
  end if;
  insert into public.group_applause (group_id, week_start, from_user, to_user)
  values (p_group, (private.week_start() at time zone 'America/Sao_Paulo')::date, auth.uid(), p_to)
  on conflict do nothing;
end $$;
revoke all on function public.applaud_member(uuid, uuid) from public, anon;
grant execute on function public.applaud_member(uuid, uuid) to authenticated;

create function public.challenge_time_duel(p_group uuid, p_opponent uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (select private.both_in_ranking(p_group, p_opponent)) then
    raise exception 'resolve_not_in_ranking' using errcode = 'P0001', hint = 'Vocês dois precisam estar no ranking de tempo do grupo.';
  end if;
  insert into public.time_duels (group_id, week_start, challenger, opponent)
  values (p_group, (private.week_start() at time zone 'America/Sao_Paulo')::date, auth.uid(), p_opponent)
  on conflict do nothing;
end $$;
revoke all on function public.challenge_time_duel(uuid, uuid) from public, anon;
grant execute on function public.challenge_time_duel(uuid, uuid) to authenticated;

-- Duelos de tempo de uma semana, com os minutos de cada lado (os dois estão no ranking por construção;
-- se alguém saiu do ranking depois, o duelo deixa de aparecer).
create function private.time_duels_of(p_group uuid, p_start timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'a', ma.nickname, 'b', mb.nickname,
           'a_minutes', private.study_seconds(d.challenger, p_start, p_start + interval '7 days') / 60,
           'b_minutes', private.study_seconds(d.opponent, p_start, p_start + interval '7 days') / 60,
           'a_me', d.challenger = auth.uid(), 'b_me', d.opponent = auth.uid()) order by d.created_at), '[]'::jsonb)
    from public.time_duels d
    join public.study_group_members ma on ma.group_id = d.group_id and ma.user_id = d.challenger and ma.left_at is null and ma.share_time
    join public.study_group_members mb on mb.group_id = d.group_id and mb.user_id = d.opponent and mb.left_at is null and mb.share_time
   where d.group_id = p_group and d.week_start = (p_start at time zone 'America/Sao_Paulo')::date;
$$;

-- Placar da semana: agora com a chave de cada pessoa (para aplaudir e desafiar), os aplausos e os duelos de tempo.
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
           case when m.share_time or m.user_id = auth.uid() then
             (select count(distinct (t at time zone 'America/Sao_Paulo')::date) from (
                select a.submitted_at as t from public.attempts a where a.user_id = m.user_id and a.submitted_at >= v_start and a.submitted_at < v_end
                union all
                select fi.started_at from public.focus_intervals fi where fi.user_id = m.user_id and fi.started_at >= v_start and fi.started_at < v_end) d) end as days_active,
           case when m.share_time then
             exists (select 1 from public.focus_intervals fi where fi.user_id = m.user_id and fi.ended_at is null and fi.started_at > now() - interval '3 hours')
             or exists (select 1 from public.attempts a where a.user_id = m.user_id and a.submitted_at > now() - interval '5 minutes') end as studying_now,
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

-- Resumo da semana passada: ranking de quem está no ranking, soma do grupo, aplausos e duelos de tempo.
create function public.group_week_recap(p_group uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_start timestamptz := private.week_start(-1);
  v_week date := (v_start at time zone 'America/Sao_Paulo')::date;
  v_rows jsonb;
begin
  if auth.uid() is null or not (select private.is_group_member(p_group)) then
    return null;
  end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.minutes desc, x.nickname), '[]'::jsonb) into v_rows
  from (
    select m.nickname, m.user_id = auth.uid() as me,
           private.study_seconds(m.user_id, v_start, v_start + interval '7 days') / 60 as minutes,
           (select count(*) from public.group_applause ga where ga.group_id = p_group and ga.week_start = v_week and ga.to_user = m.user_id) as applause
      from public.study_group_members m
     where m.group_id = p_group and m.left_at is null and m.share_time and m.joined_at < v_start + interval '7 days'
  ) x;
  return jsonb_build_object(
    'week_start', v_week,
    'total_minutes', (select coalesce(sum((r->>'minutes')::int), 0) from jsonb_array_elements(v_rows) r),
    'members', v_rows,
    'time_duels', private.time_duels_of(p_group, v_start));
end $$;
revoke all on function public.group_week_recap(uuid) from public, anon;
grant execute on function public.group_week_recap(uuid) to authenticated;
revoke all on function private.week_start(integer), private.both_in_ranking(uuid, uuid), private.time_duels_of(uuid, timestamptz) from public, anon, authenticated;
