-- Redação: banco de repertório pessoal (com fonte obrigatória) e progresso da trilha "Redação do zero".
-- Tudo é da própria conta; nada é apagado (arquivar e desmarcar guardam o histórico).

create table public.repertoire_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('citacao', 'dado', 'obra', 'fato_historico', 'conceito', 'lei')),
  content text not null check (char_length(content) between 3 and 1200 and private.text_is_safe(content)),
  origin text check (char_length(origin) <= 300 and private.text_is_safe(origin)),
  -- de onde veio: livro, artigo, lei, página; sem fonte não entra
  source text not null check (char_length(source) between 5 and 500 and private.text_is_safe(source)),
  axes text[] not null default '{}' check (cardinality(axes) <= 6),
  use_note text check (char_length(use_note) <= 800 and private.text_is_safe(use_note)),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index repertoire_items_user on public.repertoire_items (user_id, archived_at);

create table public.essay_track_progress (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  step text not null check (step ~ '^[a-z0-9-]{2,40}$'),
  done boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, step)
);

alter table public.repertoire_items enable row level security;
alter table public.essay_track_progress enable row level security;
grant select, insert, update on public.repertoire_items, public.essay_track_progress to authenticated;
create policy "repertório: a própria conta lê" on public.repertoire_items for select to authenticated using (user_id = (select auth.uid()));
create policy "repertório: a própria conta cria" on public.repertoire_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy "repertório: a própria conta altera" on public.repertoire_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "trilha: a própria conta lê" on public.essay_track_progress for select to authenticated using (user_id = (select auth.uid()));
create policy "trilha: a própria conta marca" on public.essay_track_progress for insert to authenticated with check (user_id = (select auth.uid()));
create policy "trilha: a própria conta altera" on public.essay_track_progress for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
