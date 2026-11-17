-- Polimento P5: grupos competem pelo tempo de estudo da semana.
-- Regra da plataforma `tempo-v1`: conta o tempo de foco (relógio do servidor, até 3 h por intervalo) e o tempo
-- ativo em cada questão respondida (até 15 min por questão). Períodos que se sobrepõem contam uma vez só
-- (união dos intervalos) e cada dia vale no máximo 12 h. Ninguém digita horas.
-- Aparecer no ranking é escolha de cada pessoa em cada grupo; quem não participa não tem número exposto.

alter table public.study_group_members add column share_time boolean not null default false;
alter table public.study_groups add column weekly_goal_minutes integer check (weekly_goal_minutes between 60 and 60000);

-- Segundos de estudo de uma conta num período. Só é chamada pelas funções abaixo.
create function private.study_seconds(p_user uuid, p_from timestamptz, p_to timestamptz) returns integer
language sql stable security definer set search_path = '' as $$
  with r as (
    select tstzrange(fi.started_at, least(coalesce(fi.ended_at, now()), fi.started_at + interval '3 hours')) as rg
      from public.focus_intervals fi
     where fi.user_id = p_user and fi.started_at < p_to and coalesce(fi.ended_at, now()) > p_from
    union all
    select tstzrange(a.submitted_at - make_interval(secs => least(a.active_ms, 900000) / 1000.0), a.submitted_at)
      from public.attempts a
     where a.user_id = p_user and a.submitted_at >= p_from and a.submitted_at < p_to + interval '15 minutes' and a.active_ms > 0
  ),
  u as (select coalesce(range_agg(rg), '{}'::tstzmultirange) as m from r where not isempty(rg)),
  days as (select d as s, d + interval '1 day' as e from generate_series(p_from, p_to - interval '1 second', interval '1 day') d)
  select coalesce(sum(least(43200, (
           select coalesce(sum(extract(epoch from upper(x) - lower(x))), 0)
             from unnest(u.m * tstzmultirange(tstzrange(days.s, least(days.e, p_to)))) x))), 0)::integer
    from days cross join u;
$$;
revoke all on function private.study_seconds(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Aparecer (ou não) no ranking de tempo de um grupo.
create function public.set_group_time_sharing(p_group uuid, p_share boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.study_group_members set share_time = coalesce(p_share, false)
   where group_id = p_group and user_id = auth.uid() and left_at is null;
  if not found then
    raise exception 'resolve_not_member' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.set_group_time_sharing(uuid, boolean) from public, anon;
grant execute on function public.set_group_time_sharing(uuid, boolean) to authenticated;

-- Meta coletiva da semana, em minutos somados (null tira a meta). Qualquer membro pode propor.
create function public.set_group_weekly_goal(p_group uuid, p_minutes integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_group_member(p_group)) then
    raise exception 'resolve_not_member' using errcode = 'P0001';
  end if;
  if p_minutes is not null and p_minutes not between 60 and 60000 then
    raise exception 'resolve_group_goal' using errcode = 'P0001', hint = 'Meta de 1 a 1000 horas por semana.';
  end if;
  update public.study_groups set weekly_goal_minutes = p_minutes where id = p_group;
end $$;
revoke all on function public.set_group_weekly_goal(uuid, integer) from public, anon;
grant execute on function public.set_group_weekly_goal(uuid, integer) to authenticated;

-- Placar da semana (segunda a domingo, horário de Brasília). Só membros recebem. De quem participa: apelido,
-- minutos da semana e da anterior, questões respondidas, dias com estudo e se está estudando agora. De quem
-- não participa: só o apelido. Cada pessoa sempre recebe os próprios números.
create function public.group_week_board(p_group uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_start timestamptz := date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_end timestamptz := v_start + interval '7 days';
  v_prev timestamptz := v_start - interval '7 days';
  v_rows jsonb;
begin
  if auth.uid() is null or not (select private.is_group_member(p_group)) then
    return null;
  end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.minutes desc nulls last, x.nickname), '[]'::jsonb) into v_rows
  from (
    select m.nickname, m.user_id = auth.uid() as me, m.share_time as sharing,
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
             or exists (select 1 from public.attempts a where a.user_id = m.user_id and a.submitted_at > now() - interval '5 minutes') end as studying_now
      from public.study_group_members m
     where m.group_id = p_group and m.left_at is null
  ) x;
  return jsonb_build_object(
    'week_start', (v_start at time zone 'America/Sao_Paulo')::date,
    'goal_minutes', (select g.weekly_goal_minutes from public.study_groups g where g.id = p_group),
    'total_minutes', (select coalesce(sum((r->>'minutes')::int), 0) from jsonb_array_elements(v_rows) r where (r->>'sharing')::boolean),
    'members', v_rows);
end $$;
revoke all on function public.group_week_board(uuid) from public, anon;
grant execute on function public.group_week_board(uuid) to authenticated;
