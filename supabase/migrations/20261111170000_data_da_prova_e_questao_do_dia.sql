-- Reta final e questão do dia.
-- A data da prova é informada pela própria conta e fica marcada como provisória: o Inep ainda não
-- publicou o edital do Enem 2027. Só um edital registrado como fonte pode torná-la oficial (fora daqui).
alter table public.profiles add column exam_day1 date check (exam_day1 between date '2026-01-01' and date '2100-12-31');

-- Questão do dia: escolha determinística por conta e dia entre as questões publicadas (não anuladas)
-- que a conta ainda não respondeu antes do dia; a mesma o dia inteiro, mesmo depois de respondida.
create function public.daily_question(p_local_date date) returns table (item_version_id uuid, area text, answered boolean, is_correct boolean)
language sql stable security invoker set search_path = '' as $$
  with tz as (
    select coalesce((select p.timezone from public.profiles p where p.user_id = auth.uid()), 'America/Sao_Paulo') as zone
  ), day_start as (
    select (p_local_date::timestamp at time zone (select zone from tz)) as ts
  ), pool as (
    select si.item_version_id, si.area, si.item_id
      from public.study_items si
     where not si.annulled
       and not exists (select 1 from public.attempts a where a.item_id = si.item_id and a.user_id = auth.uid()
                        and a.submitted_at < (select ts from day_start))
  ), pick as (
    select * from pool
     order by md5(auth.uid()::text || p_local_date::text || pool.item_version_id::text)
     limit 1
  )
  select pick.item_version_id, pick.area,
         exists (select 1 from public.attempts a where a.item_version_id = pick.item_version_id and a.user_id = auth.uid()
                  and a.submitted_at >= (select ts from day_start)),
         (select a.is_correct from public.attempts a where a.item_version_id = pick.item_version_id and a.user_id = auth.uid()
                  and a.submitted_at >= (select ts from day_start) order by a.submitted_at limit 1)
    from pick
   where auth.uid() is not null;
$$;
revoke all on function public.daily_question(date) from public, anon;
grant execute on function public.daily_question(date) to authenticated;
