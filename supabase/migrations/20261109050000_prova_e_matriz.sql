-- F2-T02 — Fontes, perfis de prova e matriz versionada (plano §4.1).
-- Versões publicadas são imutáveis: correções criam nova versão.

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  institution text not null check (char_length(institution) between 1 and 200),
  url text not null check (url ~ '^https://'),
  edition text,
  kind text not null check (kind in ('matriz', 'prova', 'gabarito', 'cartilha', 'microdados', 'outro')),
  retrieved_at timestamptz not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  bytes bigint check (bytes > 0),
  pages integer check (pages > 0),
  rights_status text not null check (char_length(rights_status) between 1 and 400),
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (url, sha256)
);

create table public.matrix_versions (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  effective_from date,
  source_id uuid not null references public.sources (id),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  created_at timestamptz not null default now()
);

create table public.cognitive_axes (
  id uuid primary key default gen_random_uuid(),
  matrix_version_id uuid not null references public.matrix_versions (id) on delete restrict,
  code text not null check (code ~ '^[A-Z]{2}$'),
  roman text not null,
  label text not null,
  description text not null,
  unique (matrix_version_id, code)
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  matrix_version_id uuid not null references public.matrix_versions (id) on delete restrict,
  code text not null check (code in ('LC', 'MT', 'CN', 'CH')),
  label text not null,
  unique (matrix_version_id, code),
  unique (id, matrix_version_id)
);

create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  matrix_version_id uuid not null,
  area_id uuid not null,
  code text not null check (code ~ '^C[0-9]+$'),
  number smallint not null check (number between 1 and 20),
  description text not null check (char_length(description) > 10),
  source_page integer,
  foreign key (area_id, matrix_version_id) references public.areas (id, matrix_version_id) on delete restrict,
  unique (area_id, code),
  unique (id, matrix_version_id)
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  matrix_version_id uuid not null,
  competency_id uuid not null,
  area_id uuid not null,
  code text not null check (code ~ '^H[0-9]+$'),
  number smallint not null check (number between 1 and 60),
  description text not null check (char_length(description) > 10),
  source_page integer,
  foreign key (competency_id, matrix_version_id) references public.competencies (id, matrix_version_id) on delete restrict,
  foreign key (area_id, matrix_version_id) references public.areas (id, matrix_version_id) on delete restrict,
  unique (area_id, code)
);

create table public.exam_profiles (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  target_year smallint not null check (target_year between 1998 and 2100),
  matrix_version_id uuid not null references public.matrix_versions (id),
  essay_rubric_id uuid, -- rubrica entra na F5 (F5-T02)
  day_rules_json jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'reference', 'active', 'retired')),
  source_id uuid not null references public.sources (id),
  created_at timestamptz not null default now()
);

-- Imutabilidade: nada muda dentro de uma versão publicada (nem a própria versão, exceto aposentar).
create function private.block_published_matrix_change() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_version uuid;
  v_status text;
begin
  v_version := coalesce(old.matrix_version_id, new.matrix_version_id);
  select status into v_status from public.matrix_versions where id = v_version;
  if v_status = 'published' then
    raise exception 'resolve_matrix_published_immutable' using errcode = 'P0001',
      hint = 'Versão publicada da matriz é imutável; crie uma nova versão.';
  end if;
  return coalesce(new, old);
end;
$$;

create function private.guard_matrix_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.status = 'published' then
    raise exception 'resolve_matrix_published_immutable' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' then
    if new.status not in ('published', 'retired') or new.label <> old.label
       or new.source_id <> old.source_id or new.effective_from is distinct from old.effective_from then
      raise exception 'resolve_matrix_published_immutable' using errcode = 'P0001',
        hint = 'Uma versão publicada só pode ser aposentada.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger matrix_versions_guard before update or delete on public.matrix_versions
  for each row execute function private.guard_matrix_version();
create trigger cognitive_axes_immutable before insert or update or delete on public.cognitive_axes
  for each row execute function private.block_published_matrix_change();
create trigger areas_immutable before insert or update or delete on public.areas
  for each row execute function private.block_published_matrix_change();
create trigger competencies_immutable before insert or update or delete on public.competencies
  for each row execute function private.block_published_matrix_change();
create trigger skills_immutable before insert or update or delete on public.skills
  for each row execute function private.block_published_matrix_change();

-- Fontes são registros de proveniência: só acrescentar.
create function private.block_source_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'resolve_source_append_only' using errcode = 'P0001',
    hint = 'Fonte registrada não muda; registre a nova versão do arquivo como outra fonte.';
end;
$$;
create trigger sources_append_only before update or delete on public.sources
  for each row execute function private.block_source_change();

-- Leitura para quem está logado; escrita só pelo dono do banco (papel de editor: F2-T05).
do $$
declare t text;
begin
  foreach t in array array['sources', 'matrix_versions', 'cognitive_axes', 'areas', 'competencies', 'skills', 'exam_profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('create policy "leitura para contas" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;

create index competencies_area on public.competencies (area_id);
create index skills_competency on public.skills (competency_id);
create index skills_version on public.skills (matrix_version_id);
create index exam_profiles_matrix on public.exam_profiles (matrix_version_id);
create index matrix_versions_source on public.matrix_versions (source_id);
create index exam_profiles_source on public.exam_profiles (source_id);

revoke all on all functions in schema private from public, anon, authenticated;
