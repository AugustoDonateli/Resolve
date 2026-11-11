-- Meta de curso: curso, instituição e, se você quiser, nota de corte e pesos por área — tudo informado
-- pela própria conta, com a fonte obrigatória quando há número (ex.: "Sisu 2026, 1ª chamada, ampla
-- concorrência, página do curso"). O Resolve não traz notas de corte próprias.
create function private.course_weights_ok(w jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select w is null or (jsonb_typeof(w) = 'object' and coalesce((
    select bool_and(k in ('LC', 'CH', 'CN', 'MT', 'RED') and jsonb_typeof(v) = 'number' and (v::text)::numeric between 0.1 and 10)
      from jsonb_each(w) as e(k, v)), true));
$$;

create table public.course_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course text not null check (char_length(course) between 2 and 120 and private.text_is_safe(course)),
  institution text not null check (char_length(institution) between 2 and 160 and private.text_is_safe(institution)),
  modality text check (char_length(modality) <= 120 and private.text_is_safe(modality)),
  cutoff numeric(6, 2) check (cutoff between 0 and 1000),
  -- pesos por área: {"LC": 1, "CH": 1, "CN": 2, "MT": 3, "RED": 2}
  weights jsonb check (private.course_weights_ok(weights)),
  source text check (char_length(source) between 5 and 500 and private.text_is_safe(source)),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((cutoff is null and weights is null) or source is not null)
);
create index course_goals_user on public.course_goals (user_id, archived_at);
create trigger course_goals_touch before update on public.course_goals for each row execute function private.touch_updated_at();

alter table public.course_goals enable row level security;
revoke all on public.course_goals from anon;
revoke truncate, trigger, references, delete on public.course_goals from authenticated;
grant select, insert, update on public.course_goals to authenticated;
create policy "meta de curso: a própria conta lê" on public.course_goals for select to authenticated using (user_id = (select auth.uid()));
create policy "meta de curso: a própria conta cria" on public.course_goals for insert to authenticated with check (user_id = (select auth.uid()));
create policy "meta de curso: a própria conta altera" on public.course_goals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
