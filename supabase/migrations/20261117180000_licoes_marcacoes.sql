-- Lições (plano v2, 2A.4): quem lê marca cada parte como "entendi", "confuso" ou "chato", com uma nota opcional.
-- É o retorno de Guto sobre o piloto; cada conta vê e muda só as próprias marcações.
create table public.lesson_feedback (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_slug text not null check (lesson_slug ~ '^[a-z0-9-]{3,60}$'),
  section text not null check (section in ('entrada', 'explicacao', 'exemplo', 'lacunas', 'treino', 'pegadinhas', 'cartoes')),
  verdict text not null check (verdict in ('entendi', 'confuso', 'chato')),
  note text check (char_length(note) <= 500 and private.text_is_safe(note)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_slug, section)
);
alter table public.lesson_feedback enable row level security;
revoke all on public.lesson_feedback from anon, authenticated;
grant select, insert, update (verdict, note, updated_at) on public.lesson_feedback to authenticated;
create policy "marcações: ler as próprias" on public.lesson_feedback for select to authenticated using (user_id = (select auth.uid()));
create policy "marcações: criar as próprias" on public.lesson_feedback for insert to authenticated with check (user_id = (select auth.uid()));
create policy "marcações: mudar as próprias" on public.lesson_feedback for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
