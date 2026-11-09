-- F2-T03 (itens, versões, estímulos, alternativas, cadernos) e F2-T04 (etiquetas, evidências,
-- distratores, revisão editorial). Plano §4.1 e §3 (regra 1: gabarito só após a resposta).
--
-- Blocos de conteúdo (stimulus_versions.blocks_json, item_versions.command_blocks):
--   [{"id": "b1", "type": "paragraph"|"heading"|"image"|"table"|"formula"|"source", "text": "...", "asset_id": "uuid"}]
-- Offsets de evidência usam unidades UTF-16 sobre "text" do bloco (mesma medida do JavaScript).

-- ── F2-T03 ────────────────────────────────────────────────────────────────────

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  year smallint not null check (year between 1998 and 2100),
  type text not null check (type in ('regular', 'reaplicacao', 'ppl', 'digital', 'outra')),
  label text not null,
  profile_id uuid not null references public.exam_profiles (id),
  unique (year, type, label)
);

create table public.booklets (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id),
  day smallint not null check (day between 1 and 6),
  booklet_number smallint not null check (booklet_number between 1 and 99),
  color text not null check (char_length(color) between 2 and 30),
  variant text not null default 'padrao' check (variant in ('padrao', 'ampliada', 'superampliada', 'ledor', 'libras', 'braile')),
  source_id uuid not null references public.sources (id),
  answer_key_source_id uuid references public.sources (id),
  unique (application_id, day, booklet_number, variant)
);

create table public.stimulus_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id),
  blocks_json jsonb not null check (jsonb_typeof(blocks_json) = 'array' and jsonb_array_length(blocks_json) > 0),
  fingerprint text not null,
  shared_group_id uuid,
  created_at timestamptz not null default now(),
  unique (fingerprint)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  official_item_code text unique,
  canonical_fingerprint text not null unique,
  origin_type text not null default 'official_enem' check (origin_type = 'official_enem'),
  created_at timestamptz not null default now()
);

create table public.item_versions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id),
  version smallint not null check (version >= 1),
  stimulus_version_id uuid references public.stimulus_versions (id),
  command_blocks jsonb not null check (jsonb_typeof(command_blocks) = 'array' and jsonb_array_length(command_blocks) > 0),
  area_id uuid not null references public.areas (id),
  foreign_language text check (foreign_language in ('ingles', 'espanhol')),
  content_dependency smallint check (content_dependency between 0 and 3),
  explanation_steps jsonb not null default '[]'::jsonb check (jsonb_typeof(explanation_steps) = 'array'),
  annulled boolean not null default false,
  annulment_note text,
  review_status text not null default 'draft' check (review_status in ('draft', 'in_review', 'approved', 'rejected', 'published', 'retired')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (item_id, version)
);

create table public.alternatives (
  id uuid primary key default gen_random_uuid(),
  item_version_id uuid not null references public.item_versions (id) on delete cascade,
  stable_key text not null check (stable_key in ('A', 'B', 'C', 'D', 'E')),
  content_blocks jsonb not null check (jsonb_typeof(content_blocks) = 'array' and jsonb_array_length(content_blocks) > 0),
  is_correct boolean not null default false,
  unique (item_version_id, stable_key),
  unique (id, item_version_id)
);

create table public.booklet_items (
  id uuid primary key default gen_random_uuid(),
  booklet_id uuid not null references public.booklets (id),
  position smallint not null check (position between 1 and 200),
  item_version_id uuid not null references public.item_versions (id),
  source_page smallint check (source_page >= 1),
  unique (booklet_id, position),
  unique (id, item_version_id)
);

-- Letra impressa no caderno → alternativa canônica. A chave composta impede apontar para
-- alternativa de outro item ou de outra versão.
create table public.booklet_alternative_maps (
  booklet_item_id uuid not null,
  item_version_id uuid not null,
  printed_letter text not null check (printed_letter in ('A', 'B', 'C', 'D', 'E')),
  alternative_id uuid not null,
  primary key (booklet_item_id, printed_letter),
  unique (booklet_item_id, alternative_id),
  foreign key (booklet_item_id, item_version_id) references public.booklet_items (id, item_version_id) on delete cascade,
  foreign key (alternative_id, item_version_id) references public.alternatives (id, item_version_id)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id),
  page smallint not null check (page >= 1),
  bbox numeric[] not null check (array_length(bbox, 1) = 4 and bbox[1] < bbox[3] and bbox[2] < bbox[4]),
  storage_path text,
  media_type text not null check (media_type in ('image/png', 'image/webp', 'image/svg+xml')),
  width integer check (width > 0),
  height integer check (height > 0),
  alt_text text check (char_length(alt_text) <= 2000),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

-- ── F2-T04 ────────────────────────────────────────────────────────────────────

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.subjects (id),
  area_code text not null check (area_code in ('LC', 'MT', 'CN', 'CH')),
  label text not null check (char_length(label) between 1 and 200),
  source_id uuid references public.sources (id),
  unique (parent_id, label)
);

create table public.skill_subject_links (
  skill_id uuid not null references public.skills (id),
  subject_id uuid not null references public.subjects (id),
  primary key (skill_id, subject_id)
);

create table public.item_skill_tags (
  item_version_id uuid not null references public.item_versions (id) on delete cascade,
  skill_id uuid not null references public.skills (id),
  is_primary boolean not null default false,
  confidence numeric check (confidence between 0 and 1),
  proposed_by text not null check (proposed_by in ('modelo', 'editor')),
  model_info jsonb,
  review_status text not null default 'proposta' check (review_status in ('proposta', 'aprovada', 'rejeitada')),
  reviewer_id uuid references auth.users (id),
  primary key (item_version_id, skill_id)
);
create unique index item_skill_one_primary on public.item_skill_tags (item_version_id) where is_primary;

create table public.item_subject_tags (
  item_version_id uuid not null references public.item_versions (id) on delete cascade,
  subject_id uuid not null references public.subjects (id),
  is_primary boolean not null default false,
  confidence numeric check (confidence between 0 and 1),
  proposed_by text not null check (proposed_by in ('modelo', 'editor')),
  model_info jsonb,
  review_status text not null default 'proposta' check (review_status in ('proposta', 'aprovada', 'rejeitada')),
  reviewer_id uuid references auth.users (id),
  primary key (item_version_id, subject_id)
);

-- Evidência: trecho de texto (vários trechos = várias linhas com o mesmo group_id),
-- região de figura (bbox normalizado 0–1) ou passo de cálculo da resolução.
create table public.evidence_annotations (
  id uuid primary key default gen_random_uuid(),
  item_version_id uuid not null references public.item_versions (id) on delete cascade,
  group_id uuid not null default gen_random_uuid(),
  target_type text not null check (target_type in ('text', 'figure', 'calculation')),
  block_id text,
  start_utf16 integer,
  end_utf16 integer,
  asset_id uuid references public.assets (id),
  normalized_bbox numeric[],
  explanation_step_id text,
  rationale text check (char_length(rationale) <= 2000),
  check (
    (target_type = 'text' and block_id is not null and start_utf16 >= 0 and end_utf16 > start_utf16
       and asset_id is null and normalized_bbox is null and explanation_step_id is null)
    or (target_type = 'figure' and asset_id is not null and array_length(normalized_bbox, 1) = 4
       and normalized_bbox[1] >= 0 and normalized_bbox[2] >= 0 and normalized_bbox[3] <= 1 and normalized_bbox[4] <= 1
       and normalized_bbox[1] < normalized_bbox[3] and normalized_bbox[2] < normalized_bbox[4]
       and block_id is null and start_utf16 is null and end_utf16 is null and explanation_step_id is null)
    or (target_type = 'calculation' and explanation_step_id is not null
       and block_id is null and start_utf16 is null and asset_id is null and normalized_bbox is null)
  )
);

create table public.distractor_types (
  id uuid primary key default gen_random_uuid(),
  taxonomy_version text not null,
  code text not null check (code ~ '^[a-z_]+$'),
  label text not null,
  definition text not null,
  limits text,
  reviewed_example text,
  unique (taxonomy_version, code)
);

create table public.alternative_annotations (
  alternative_id uuid not null references public.alternatives (id) on delete cascade,
  type_id uuid not null references public.distractor_types (id),
  is_primary boolean not null default false,
  rationale text not null default '' check (char_length(rationale) <= 2000),
  review_status text not null default 'proposta' check (review_status in ('proposta', 'aprovada', 'rejeitada')),
  primary key (alternative_id, type_id)
);
create unique index alternative_one_primary on public.alternative_annotations (alternative_id) where is_primary;

create table public.editorial_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('item_version', 'stimulus_version', 'asset', 'tags')),
  entity_version_id uuid not null,
  reviewer_id uuid not null references auth.users (id),
  checklist jsonb not null default '{}'::jsonb,
  decision text not null check (decision in ('aprovar', 'devolver', 'rejeitar')),
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now()
);

-- ── Regras ────────────────────────────────────────────────────────────────────

-- Comprimento em unidades UTF-16 (caracteres fora do plano básico contam 2).
create function private.utf16_length(t text) returns integer
language sql immutable strict set search_path = '' as $$
  select coalesce(sum(case when ascii(c) > 65535 then 2 else 1 end), 0)::integer
  from regexp_split_to_table(t, '') as c;
$$;

-- Evidência de texto deve apontar para bloco existente da versão exata e caber no texto dele.
create function private.validate_evidence() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_text text;
begin
  if new.target_type = 'text' then
    select b->>'text' into v_text
    from public.item_versions iv
    left join public.stimulus_versions sv on sv.id = iv.stimulus_version_id
    cross join lateral jsonb_array_elements(coalesce(sv.blocks_json, '[]'::jsonb) || iv.command_blocks) b
    where iv.id = new.item_version_id and b->>'id' = new.block_id
    limit 1;
    if v_text is null then
      raise exception 'resolve_evidence_block_missing' using errcode = 'P0001', hint = 'Bloco inexistente nesta versão do item.';
    end if;
    if new.end_utf16 > private.utf16_length(v_text) then
      raise exception 'resolve_evidence_out_of_range' using errcode = 'P0001', hint = 'Trecho ultrapassa o texto do bloco nesta versão.';
    end if;
  elsif new.target_type = 'calculation' then
    if not exists (
      select 1 from public.item_versions iv, jsonb_array_elements(iv.explanation_steps) st
      where iv.id = new.item_version_id and st->>'id' = new.explanation_step_id
    ) then
      raise exception 'resolve_evidence_step_missing' using errcode = 'P0001', hint = 'Passo de resolução inexistente nesta versão.';
    end if;
  end if;
  return new;
end;
$$;
create trigger evidence_validate before insert or update on public.evidence_annotations
  for each row execute function private.validate_evidence();

-- "Não classificado" exige justificativa editorial.
create function private.validate_alternative_annotation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select code from public.distractor_types where id = new.type_id) = 'nao_classificado'
     and char_length(trim(new.rationale)) < 10 then
    raise exception 'resolve_unclassified_needs_rationale' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger alternative_annotation_validate before insert or update on public.alternative_annotations
  for each row execute function private.validate_alternative_annotation();

-- Versão publicada: imutável (exceto aposentar). Publicar exige 5 alternativas e, se não anulado, 1 correta.
create function private.guard_item_version() returns trigger
language plpgsql set search_path = '' as $$
declare
  n int; ncorrect int;
begin
  if tg_op = 'DELETE' then
    if old.review_status = 'published' then
      raise exception 'resolve_item_published_immutable' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.review_status = 'published' then
    if new.review_status = 'retired' and (to_jsonb(new) - 'review_status') = (to_jsonb(old) - 'review_status') then
      return new;
    end if;
    raise exception 'resolve_item_published_immutable' using errcode = 'P0001',
      hint = 'Correção cria nova versão do item.';
  end if;
  if new.review_status = 'published' then
    select count(*), count(*) filter (where is_correct) into n, ncorrect from public.alternatives where item_version_id = new.id;
    if n <> 5 or (not new.annulled and ncorrect <> 1) then
      raise exception 'resolve_item_publish_invalid' using errcode = 'P0001',
        hint = format('Publicação exige 5 alternativas e 1 correta (encontradas %s e %s).', n, ncorrect);
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;
create trigger item_versions_guard before update or delete on public.item_versions
  for each row execute function private.guard_item_version();

-- Filhos de versão publicada (alternativas, etiquetas, evidências) também ficam imutáveis.
create function private.block_published_item_children() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_status text;
begin
  select review_status into v_status from public.item_versions
  where id = coalesce(new.item_version_id, old.item_version_id);
  if v_status = 'published' then
    raise exception 'resolve_item_published_immutable' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger alternatives_immutable before insert or update or delete on public.alternatives
  for each row execute function private.block_published_item_children();
create trigger evidence_immutable before insert or update or delete on public.evidence_annotations
  for each row execute function private.block_published_item_children();
create trigger item_skill_tags_immutable before insert or update or delete on public.item_skill_tags
  for each row execute function private.block_published_item_children();

-- Estímulos são versões: não mudam depois de criados.
create function private.block_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'resolve_append_only' using errcode = 'P0001', hint = 'Crie uma nova versão.';
end;
$$;
create trigger stimulus_versions_append_only before update on public.stimulus_versions
  for each row execute function private.block_update();

-- ── Acesso ────────────────────────────────────────────────────────────────────
-- Leitura só de conteúdo publicado. Gabarito (is_correct), resolução e anotações explicativas
-- não são legíveis pelo aluno: serão entregues por função após a resposta (F3-T04).

do $$
declare t text;
begin
  foreach t in array array['applications', 'booklets', 'stimulus_versions', 'items', 'item_versions', 'alternatives',
    'booklet_items', 'booklet_alternative_maps', 'assets', 'subjects', 'skill_subject_links', 'item_skill_tags',
    'item_subject_tags', 'evidence_annotations', 'distractor_types', 'alternative_annotations', 'editorial_reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;

create policy "contas leem aplicações" on public.applications for select to authenticated using (true);
create policy "contas leem cadernos" on public.booklets for select to authenticated using (true);
create policy "contas leem assuntos" on public.subjects for select to authenticated using (true);
create policy "contas leem vínculos de assunto" on public.skill_subject_links for select to authenticated using (true);
create policy "contas leem tipos de distrator" on public.distractor_types for select to authenticated using (true);

create policy "item publicado" on public.item_versions for select to authenticated using (review_status = 'published');
create policy "item de versão publicada" on public.items for select to authenticated
  using (exists (select 1 from public.item_versions iv where iv.item_id = items.id and iv.review_status = 'published'));
create policy "estímulo de item publicado" on public.stimulus_versions for select to authenticated
  using (exists (select 1 from public.item_versions iv where iv.stimulus_version_id = stimulus_versions.id and iv.review_status = 'published'));
create policy "alternativa de item publicado" on public.alternatives for select to authenticated
  using (exists (select 1 from public.item_versions iv where iv.id = alternatives.item_version_id and iv.review_status = 'published'));
create policy "posição de item publicado" on public.booklet_items for select to authenticated
  using (exists (select 1 from public.item_versions iv where iv.id = booklet_items.item_version_id and iv.review_status = 'published'));
create policy "mapa de letras de item publicado" on public.booklet_alternative_maps for select to authenticated
  using (exists (select 1 from public.item_versions iv where iv.id = booklet_alternative_maps.item_version_id and iv.review_status = 'published'));
create policy "figura com fonte registrada" on public.assets for select to authenticated using (true);
create policy "habilidade aprovada de item publicado" on public.item_skill_tags for select to authenticated
  using (review_status = 'aprovada' and exists (select 1 from public.item_versions iv where iv.id = item_skill_tags.item_version_id and iv.review_status = 'published'));
create policy "assunto aprovado de item publicado" on public.item_subject_tags for select to authenticated
  using (review_status = 'aprovada' and exists (select 1 from public.item_versions iv where iv.id = item_subject_tags.item_version_id and iv.review_status = 'published'));
-- evidence_annotations, alternative_annotations, editorial_reviews: sem leitura direta pelo aluno.

-- Colunas que revelam a resposta ficam fora do alcance do aluno.
revoke select on public.alternatives from authenticated;
grant select (id, item_version_id, stable_key, content_blocks) on public.alternatives to authenticated;
revoke select on public.item_versions from authenticated;
grant select (id, item_id, version, stimulus_version_id, command_blocks, area_id, foreign_language, annulled, review_status, published_at)
  on public.item_versions to authenticated;

-- Índices de chaves estrangeiras.
create index booklets_application on public.booklets (application_id);
create index booklets_source on public.booklets (source_id);
create index booklets_answer_key on public.booklets (answer_key_source_id);
create index applications_profile on public.applications (profile_id);
create index stimulus_source on public.stimulus_versions (source_id);
create index item_versions_item on public.item_versions (item_id);
create index item_versions_stimulus on public.item_versions (stimulus_version_id);
create index item_versions_area on public.item_versions (area_id);
create index booklet_items_version on public.booklet_items (item_version_id);
create index bam_alternative on public.booklet_alternative_maps (alternative_id, item_version_id);
create index bam_item on public.booklet_alternative_maps (booklet_item_id, item_version_id);
create index assets_source on public.assets (source_id);
create index subjects_parent on public.subjects (parent_id);
create index subjects_source on public.subjects (source_id);
create index ssl_subject on public.skill_subject_links (subject_id);
create index ist_skill on public.item_skill_tags (skill_id);
create index ist_reviewer on public.item_skill_tags (reviewer_id);
create index isubt_subject on public.item_subject_tags (subject_id);
create index isubt_reviewer on public.item_subject_tags (reviewer_id);
create index evidence_item on public.evidence_annotations (item_version_id);
create index evidence_asset on public.evidence_annotations (asset_id);
create index altann_type on public.alternative_annotations (type_id);
create index reviews_reviewer on public.editorial_reviews (reviewer_id);
create index reviews_entity on public.editorial_reviews (entity_type, entity_version_id);

-- Taxonomia inicial de distratores (plano §4.1). Definições editoriais do Resolve, versão de proposta:
-- exemplos revisados entram quando houver itens publicados.
insert into public.distractor_types (taxonomy_version, code, label, definition, limits) values
  ('v0-proposta', 'extrapolacao', 'Extrapolação', 'Vai além do que o texto ou o comando autoriza concluir.', 'Não usar quando a alternativa contradiz o texto: aí é contradição.'),
  ('v0-proposta', 'reducao', 'Redução', 'Fica com parte da ideia e perde o elemento que responde ao comando.', 'A parte retida precisa ser verdadeira no texto.'),
  ('v0-proposta', 'contradicao', 'Contradição', 'Afirma o oposto do que o texto ou o enunciado estabelece.', 'Exige trecho que sustente a oposição.'),
  ('v0-proposta', 'verdade_fora_do_comando', 'Verdade fora do comando', 'Afirmação correta em si que não responde ao que foi pedido.', 'Não confundir com redução: aqui o conteúdo não pertence à pergunta.'),
  ('v0-proposta', 'inversao_causa_efeito', 'Inversão de causa e efeito', 'Troca a relação causal ou a ordem entre fenômenos.', 'Exige relação causal explícita no texto ou no conhecimento cobrado.'),
  ('v0-proposta', 'generalizacao', 'Generalização', 'Estende a todos os casos uma afirmação válida para casos específicos.', 'Marcadores típicos: sempre, nunca, todos, qualquer.'),
  ('v0-proposta', 'isca_de_palavra', 'Isca de palavra', 'Reaproveita termos do texto em uma relação que o texto não faz.', 'A semelhança lexical precisa ser o atrativo principal.'),
  ('v0-proposta', 'erro_de_calculo_previsto', 'Erro de cálculo previsto', 'Corresponde ao resultado de um erro de procedimento esperado.', 'Indicar qual passo errado leva ao valor.'),
  ('v0-proposta', 'nao_classificado', 'Não classificado', 'Nenhum tipo da taxonomia descreve a alternativa com segurança.', 'Exige justificativa editorial.');

revoke all on all functions in schema private from public, anon, authenticated;
