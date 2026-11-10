-- F4-T15 — Agenda automática básica. Plano §4.4: study_blocks (tipo, início, duração, estado) — planejado,
-- em curso, concluído, remarcado ou dispensado. O plano do dia guarda também o que ficou de fora e por quê
-- (study_plan_days), para a explicação continuar disponível depois de recarregar.
-- Horários no fuso em que o plano foi feito: data local + minuto do dia.
create table public.study_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  timezone text not null check (char_length(timezone) between 1 and 64),
  start_minute smallint not null check (start_minute between 0 and 1439),
  planned_minutes smallint not null check (planned_minutes between 5 and 240),
  kind text not null check (kind in ('revisao', 'treino', 'redacao')),
  area_code text check (area_code in ('LC', 'MT', 'CN', 'CH', 'RED')),
  title text not null check (char_length(trim(title)) between 1 and 120 and private.text_is_safe(title)),
  reason text check (char_length(reason) <= 300 and private.text_is_safe(reason)),
  status text not null default 'planejado' check (status in ('planejado', 'em_curso', 'concluido', 'remarcado', 'dispensado')),
  actual_minutes smallint check (actual_minutes between 0 and 600),
  source text not null default 'agenda-v1' check (source in ('agenda-v1', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_minute + planned_minutes <= 1440)
);
create index study_blocks_user_date on public.study_blocks (user_id, local_date, start_minute);

create table public.study_plan_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  local_date date not null,
  left_out jsonb not null default '[]'::jsonb check (jsonb_typeof(left_out) = 'array' and private.json_strings_are_safe(left_out)),
  rule_version text not null default 'agenda-v1',
  generated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create trigger study_blocks_touch before update on public.study_blocks for each row execute function private.touch_owned_row();

alter table public.study_blocks enable row level security;
alter table public.study_plan_days enable row level security;
revoke all on public.study_blocks, public.study_plan_days from anon, authenticated;
grant select, insert, update, delete on public.study_blocks, public.study_plan_days to authenticated;
create policy "blocos: os próprios" on public.study_blocks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "plano do dia: o próprio" on public.study_plan_days for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
