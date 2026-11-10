-- F4-T14 — Metas e planos se-então. Critério: meta diária/semanal/área e plano alternativo podem ser editados e
-- recuperados. Plano §4.4: goals (level, area, target_score, target_minutes, period) e if_then_plans
-- (trigger_text, alternative_activity, duration_minutes, priority).
-- Recuperar = arquivar e restaurar (nada é apagado ao arquivar). Uma meta ativa por nível (e por área).
-- A nota-alvo é escolha do aluno (0–1000), não estimativa do sistema.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  level text not null check (level in ('diaria', 'semanal', 'area')),
  area_code text check (area_code in ('LC', 'MT', 'CN', 'CH', 'RED')),
  target_minutes integer check (target_minutes between 5 and 10080),
  target_score numeric(5, 1) check (target_score between 0 and 1000),
  period_start date not null default current_date,
  period_end date,
  note text check (char_length(note) <= 200 and private.text_is_safe(note)),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((level = 'area') = (area_code is not null)),
  check (level = 'area' or target_minutes is not null),
  check (level <> 'diaria' or target_minutes <= 1440),
  check (level = 'area' or target_score is null),
  check (level <> 'area' or target_score is not null or target_minutes is not null),
  check (period_end is null or period_end >= period_start)
);
create unique index goals_one_active on public.goals (user_id, level, coalesce(area_code, '-')) where archived_at is null;

create table public.if_then_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trigger_text text not null check (char_length(trim(trigger_text)) between 3 and 200 and private.text_is_safe(trigger_text)),
  alternative_activity text not null check (char_length(trim(alternative_activity)) between 3 and 200 and private.text_is_safe(alternative_activity)),
  duration_minutes smallint not null check (duration_minutes between 1 and 60),
  priority smallint not null default 1 check (priority between 1 and 99),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.touch_owned_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.user_id <> old.user_id then
    raise exception 'resolve_owner_immutable' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger goals_touch before update on public.goals for each row execute function private.touch_owned_row();
create trigger if_then_plans_touch before update on public.if_then_plans for each row execute function private.touch_owned_row();

alter table public.goals enable row level security;
alter table public.if_then_plans enable row level security;
revoke all on public.goals, public.if_then_plans from anon, authenticated;
grant select, insert, update, delete on public.goals, public.if_then_plans to authenticated;
create policy "metas: as próprias" on public.goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "planos se-então: os próprios" on public.if_then_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create index if_then_plans_user on public.if_then_plans (user_id, priority) where archived_at is null;
revoke all on function private.touch_owned_row() from public, anon, authenticated;
