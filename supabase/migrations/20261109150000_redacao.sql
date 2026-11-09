-- F5-T02 — Esquema de redação: rubrica oficial, eixos, temas e textos motivadores, redações e
-- versões, filas de avaliação, avaliações, resultados e anotações. Plano §4.5 e §7 ("Redação").
--   - versão submetida é imutável (texto, parágrafos e impressão digital congelados);
--   - outra conta não lê texto nem arquivo (nem o editor: redação é dado pessoal);
--   - notas só nos degraus da rubrica, total igual à soma, trecho anotado existe no texto avaliado;
--   - tema só é publicado com texto motivador de fonte conferida; publicado não muda.

-- ── Rubrica (Inep, Matrizes de Referência, abril de 2026, p. 29–31) ─────────────
create table public.essay_rubrics (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (version ~ '^[a-z0-9.-]{1,40}$'),
  label text not null,
  source_id uuid not null references public.sources (id),
  source_pages smallint[] not null,
  allowed_scores smallint[] not null check (cardinality(allowed_scores) between 2 and 20),
  discrepancy_rules jsonb,
  status text not null default 'published' check (status in ('draft', 'published', 'retired')),
  note text,
  created_at timestamptz not null default now()
);

create table public.rubric_dimensions (
  id uuid primary key default gen_random_uuid(),
  rubric_id uuid not null references public.essay_rubrics (id),
  code text not null check (code ~ '^C[1-9]$'),
  roman text not null,
  title text not null,
  levels jsonb not null check (jsonb_typeof(levels) = 'array' and jsonb_array_length(levels) between 2 and 20),
  position smallint not null,
  unique (rubric_id, code),
  unique (rubric_id, position)
);

do $seed$
declare
  r jsonb := '{"source": {"title": "Matrizes de Referência – Enem", "institution": "Inep/MEC", "url": "https://download.inep.gov.br/enem/outros_documentos/enem_matriz_de_referencia_v1.pdf", "sha256": "4f540d5439df00f88e13363ecaff3d884b83d16c1ae6cedbe5c2c3aabbf288b6", "pages": [29, 30, 31]}, "label": "Redação do Enem — competências e níveis (Inep, abril de 2026)", "allowed_scores": [0, 40, 80, 120, 160, 200], "competencies": [{"code": "C1", "roman": "I", "title": "Demonstrar domínio da modalidade escrita formal da língua portuguesa.", "levels": [{"score": 200, "description": "Demonstra excelente domínio da modalidade escrita formal da língua portuguesa e de escolha de registro. Desvios gramaticais ou de convenções da escrita serão aceitos somente como excepcionalidade e quando não caracterizarem reincidência.", "page": 29}, {"score": 160, "description": "Demonstra bom domínio da modalidade escrita formal da língua portuguesa e de escolha de registro, com poucos desvios gramaticais e de convenções da escrita.", "page": 29}, {"score": 120, "description": "Demonstra domínio mediano da modalidade escrita formal da língua portuguesa e de escolha de registro, com alguns desvios gramaticais e de convenções da escrita.", "page": 29}, {"score": 80, "description": "Demonstra domínio insuficiente da modalidade escrita formal da língua portuguesa, com muitos desvios gramaticais, de escolha de registro e de convenções da escrita.", "page": 29}, {"score": 40, "description": "Demonstra domínio precário da modalidade escrita formal da língua portuguesa, de forma sistemática, com diversificados e frequentes desvios gramaticais, de escolha de registro e de convenções da escrita.", "page": 29}, {"score": 0, "description": "Demonstra desconhecimento da modalidade escrita formal da língua portuguesa.", "page": 29}]}, {"code": "C2", "roman": "II", "title": "Compreender a proposta de redação e aplicar conceitos das várias áreas de conhecimento para desenvolver o tema dentro dos limites estruturais do texto dissertativo-argumentativo em prosa.", "levels": [{"score": 200, "description": "Desenvolve o tema por meio de argumentação consistente, a partir de um repertório sociocultural produtivo, e apresenta excelente domínio do texto dissertativo-argumentativo.", "page": 30}, {"score": 160, "description": "Desenvolve o tema por meio de argumentação consistente e apresenta bom domínio do texto dissertativo-argumentativo, com proposição, argumentação e conclusão.", "page": 30}, {"score": 120, "description": "Desenvolve o tema por meio de argumentação previsível e apresenta domínio mediano do texto dissertativo-argumentativo, com proposição, argumentação e conclusão.", "page": 30}, {"score": 80, "description": "Desenvolve o tema recorrendo à cópia de trechos dos textos motivadores ou apresenta domínio insuficiente do texto dissertativo-argumentativo, não atendendo à estrutura com proposição, argumentação e conclusão.", "page": 30}, {"score": 40, "description": "Apresenta o assunto, tangenciando o tema, ou demonstra domínio precário do texto dissertativo-argumentativo, com traços constantes de outros tipos textuais.", "page": 30}, {"score": 0, "description": "Fuga ao tema/não atendimento à estrutura dissertativo-argumentativa. Nestes casos a redação recebe nota 0 (zero) e é anulada.", "page": 30}]}, {"code": "C3", "roman": "III", "title": "Selecionar, relacionar, organizar e interpretar informações, fatos, opiniões e argumentos em defesa de um ponto de vista.", "levels": [{"score": 200, "description": "Apresenta informações, fatos e opiniões relacionados ao tema proposto, de forma consistente e organizada, configurando autoria, em defesa de um ponto de vista.", "page": 30}, {"score": 160, "description": "Apresenta informações, fatos e opiniões relacionados ao tema, de forma organizada, com indícios de autoria, em defesa de um ponto de vista.", "page": 30}, {"score": 120, "description": "Apresenta informações, fatos e opiniões relacionados ao tema, limitados aos argumentos dos textos motivadores e pouco organizados, em defesa de um ponto de vista.", "page": 30}, {"score": 80, "description": "Apresenta informações, fatos e opiniões relacionados ao tema, mas desorganizados ou contraditórios e limitados aos argumentos dos textos motivadores, em defesa de um ponto de vista.", "page": 30}, {"score": 40, "description": "Apresenta informações, fatos e opiniões pouco relacionados ao tema ou incoerentes e sem defesa de um ponto de vista.", "page": 30}, {"score": 0, "description": "Apresenta informações, fatos e opiniões não relacionados ao tema e sem defesa de um ponto de vista.", "page": 30}]}, {"code": "C4", "roman": "IV", "title": "Demonstrar conhecimento dos mecanismos linguísticos necessários para a construção da argumentação.", "levels": [{"score": 200, "description": "Articula bem as partes do texto e apresenta repertório diversificado de recursos coesivos.", "page": 31}, {"score": 160, "description": "Articula as partes do texto, com poucas inadequações, e apresenta repertório diversificado de recursos coesivos.", "page": 31}, {"score": 120, "description": "Articula as partes do texto, de forma mediana, com inadequações, e apresenta repertório pouco diversificado de recursos coesivos.", "page": 31}, {"score": 80, "description": "Articula as partes do texto, de forma insuficiente, com muitas inadequações, e apresenta repertório limitado de recursos coesivos.", "page": 31}, {"score": 40, "description": "Articula as partes do texto de forma precária.", "page": 31}, {"score": 0, "description": "Não articula as informações.", "page": 31}]}, {"code": "C5", "roman": "V", "title": "Elaborar proposta de intervenção para o problema abordado, respeitando os direitos humanos.", "levels": [{"score": 200, "description": "Elabora muito bem proposta de intervenção, detalhada, relacionada ao tema e articulada à discussão desenvolvida no texto.", "page": 31}, {"score": 160, "description": "Elabora bem proposta de intervenção relacionada ao tema e articulada à discussão desenvolvida no texto.", "page": 31}, {"score": 120, "description": "Elabora, de forma mediana, proposta de intervenção relacionada ao tema e articulada à discussão desenvolvida no texto.", "page": 31}, {"score": 80, "description": "Elabora, de forma insuficiente, proposta de intervenção relacionada ao tema, ou não articulada com a discussão desenvolvida no texto.", "page": 31}, {"score": 40, "description": "Apresenta proposta de intervenção vaga, precária ou relacionada apenas ao assunto.", "page": 31}, {"score": 0, "description": "Não apresenta proposta de intervenção ou apresenta proposta não relacionada ao tema ou ao assunto.", "page": 31}]}], "note": "Regras de discrepância e consolidação entre avaliadores não constam desta publicação; ficam para a F5-T11 com fonte própria."}'::jsonb;
  v_src uuid := (select s.id from public.sources s where s.sha256 = r->'source'->>'sha256' limit 1);
  v_rub uuid; c jsonb; i int := 0;
begin
  if v_src is null then
    raise exception 'fonte da matriz não registrada (sha256 %)', r->'source'->>'sha256';
  end if;
  insert into public.essay_rubrics (version, label, source_id, source_pages, allowed_scores, note)
  values ('enem-redacao-v1', r->>'label', v_src,
          array(select x::smallint from jsonb_array_elements_text(r->'source'->'pages') x),
          array(select x::smallint from jsonb_array_elements_text(r->'allowed_scores') x), r->>'note')
  returning id into v_rub;
  for c in select * from jsonb_array_elements(r->'competencies') loop
    i := i + 1;
    insert into public.rubric_dimensions (rubric_id, code, roman, title, levels, position)
    values (v_rub, c->>'code', c->>'roman', c->>'title', c->'levels', i);
  end loop;
end $seed$;

create trigger essay_rubrics_append_only before update or delete on public.essay_rubrics
  for each row execute function private.block_update();
create trigger rubric_dimensions_append_only before update or delete on public.rubric_dimensions
  for each row execute function private.block_update();

-- ── Eixos, temas e textos motivadores (editoria) ─────────────────────────────
create table public.essay_axes (
  id uuid primary key default gen_random_uuid(),
  label text not null unique check (char_length(label) between 2 and 120 and private.text_is_safe(label)),
  created_at timestamptz not null default now()
);

create table public.essay_prompts (
  id uuid primary key default gen_random_uuid(),
  axis_id uuid references public.essay_axes (id),
  title text not null check (char_length(title) between 5 and 300 and private.text_is_safe(title)),
  instruction text not null check (char_length(instruction) between 10 and 4000 and private.text_is_safe(instruction)),
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  generation_version text check (char_length(generation_version) <= 60),
  created_by uuid default auth.uid() references auth.users (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'draft') = (published_at is null))
);

create table public.motivating_texts (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.essay_prompts (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  excerpt text not null check (char_length(excerpt) between 1 and 8000 and private.text_is_safe(excerpt)),
  source_id uuid not null references public.sources (id),
  page_or_locator text not null check (char_length(page_or_locator) between 1 and 200 and private.text_is_safe(page_or_locator)),
  rights_status text not null default 'pendente' check (rights_status in ('verificado', 'pendente', 'restrito')),
  unique (prompt_id, position)
);

-- Publicar exige texto motivador com fonte e direitos conferidos; tema publicado não muda (só aposenta).
create function private.guard_essay_prompt() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'resolve_prompt_published_immutable' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if old.status = 'published' and new.status = 'retired'
       and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
      return new;
    end if;
    raise exception 'resolve_prompt_published_immutable' using errcode = 'P0001';
  end if;
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      raise exception 'resolve_prompt_publish_invalid' using errcode = 'P0001', hint = 'Crie como rascunho, inclua os textos motivadores e publique.';
    end if;
    if not exists (select 1 from public.motivating_texts m where m.prompt_id = new.id)
       or exists (select 1 from public.motivating_texts m where m.prompt_id = new.id and m.rights_status <> 'verificado') then
      raise exception 'resolve_prompt_sources_unverified' using errcode = 'P0001',
        hint = 'Tema só é publicado com texto motivador de fonte e direitos conferidos.';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;
create trigger essay_prompts_guard before insert or update or delete on public.essay_prompts
  for each row execute function private.guard_essay_prompt();

create function private.guard_motivating_text() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.essay_prompts p where p.id = coalesce(new.prompt_id, old.prompt_id) and p.status <> 'draft') then
    raise exception 'resolve_prompt_published_immutable' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger motivating_texts_guard before insert or update or delete on public.motivating_texts
  for each row execute function private.guard_motivating_text();

-- ── Perfil da folha simulada (preenchido na F5-T06) ───────────────────────────
create table public.essay_layout_profiles (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (version ~ '^[a-z0-9.-]{1,40}$'),
  font_asset_hash text not null check (font_asset_hash ~ '^[0-9a-f]{64}$'),
  font_size numeric not null check (font_size > 0),
  line_height numeric not null check (line_height > 0),
  canonical_width numeric not null check (canonical_width > 0),
  line_limit smallint not null default 30 check (line_limit between 1 and 60),
  wrapping_version text not null,
  created_at timestamptz not null default now()
);
create trigger essay_layout_profiles_append_only before update or delete on public.essay_layout_profiles
  for each row execute function private.block_update();

-- ── Redações e versões (dado pessoal) ─────────────────────────────────────────
create table public.essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  prompt_id uuid references public.essay_prompts (id),
  training_piece text check (training_piece in ('introducao', 'desenvolvimento', 'conclusao', 'intervencao')),
  created_at timestamptz not null default now()
);

-- Texto do aluno: sem caracteres de controle (exceto quebra de linha e tabulação) nem inversão de
-- direção. Não passa pelo filtro de HTML: é exibido sempre como texto, nunca interpretado.
create function private.essay_text_ok(t text) returns boolean
language sql immutable set search_path = '' as $$
  select t is not null and char_length(t) <= 20000
     and t !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]'
     and t !~ '[‪-‮⁦-⁩‎‏]';
$$;

create table public.essay_versions (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references public.essays (id) on delete cascade,
  parent_id uuid references public.essay_versions (id),
  status text not null default 'rascunho' check (status in ('rascunho', 'submetida')),
  paragraphs_json jsonb not null default '[]'::jsonb,
  plain_text text not null default '',
  layout_profile_id uuid references public.essay_layout_profiles (id),
  simulated_lines smallint check (simulated_lines between 0 and 200),
  attachment_path text check (attachment_path ~ '^[0-9a-f-]{36}/redacoes/[A-Za-z0-9._-]{1,120}$'),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(paragraphs_json) = 'array' and jsonb_array_length(paragraphs_json) <= 60),
  check (private.essay_text_ok(plain_text)),
  check ((status = 'submetida') = (submitted_at is not null and sha256 is not null))
);

-- Parágrafos válidos ({id, text}); texto corrido derivado dos parágrafos; anexo só na pasta do dono;
-- submeter congela tudo e grava a impressão digital do texto.
create function private.guard_essay_version() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_owner uuid;
begin
  if tg_op = 'DELETE' then
    if old.status = 'submetida' then
      raise exception 'resolve_essay_submitted_immutable' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'submetida' then
    raise exception 'resolve_essay_submitted_immutable' using errcode = 'P0001', hint = 'Reescrita cria uma nova versão.';
  end if;
  if tg_op = 'UPDATE' and new.essay_id <> old.essay_id then
    raise exception 'resolve_essay_version_moved' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(new.paragraphs_json) p
             where jsonb_typeof(p) <> 'object' or (p->>'id') !~ '^[a-z0-9_-]{1,24}$'
                or jsonb_typeof(p->'text') <> 'string'
                or exists (select 1 from jsonb_object_keys(p) k where k not in ('id', 'text')))
     or (select count(distinct p->>'id') from jsonb_array_elements(new.paragraphs_json) p) <> jsonb_array_length(new.paragraphs_json) then
    raise exception 'resolve_essay_paragraphs_invalid' using errcode = 'P0001';
  end if;
  new.plain_text := coalesce((select string_agg(p->>'text', E'\n\n' order by ord)
                              from jsonb_array_elements(new.paragraphs_json) with ordinality as t(p, ord)), '');
  select e.user_id into v_owner from public.essays e where e.id = new.essay_id;
  if new.attachment_path is not null and split_part(new.attachment_path, '/', 1) <> v_owner::text then
    raise exception 'resolve_essay_attachment_foreign' using errcode = 'P0001', hint = 'Anexo só na pasta da própria conta.';
  end if;
  if new.parent_id is not null and not exists (select 1 from public.essay_versions pv where pv.id = new.parent_id and pv.essay_id = new.essay_id) then
    raise exception 'resolve_essay_parent_invalid' using errcode = 'P0001';
  end if;
  if new.status = 'submetida' then
    if char_length(trim(new.plain_text)) = 0 then
      raise exception 'resolve_essay_empty' using errcode = 'P0001';
    end if;
    new.submitted_at := now();
    new.sha256 := encode(extensions.digest(convert_to(new.plain_text, 'UTF8'), 'sha256'), 'hex');
  else
    new.submitted_at := null;
    new.sha256 := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger essay_versions_guard before insert or update or delete on public.essay_versions
  for each row execute function private.guard_essay_version();

-- ── Avaliações (escrita só pelo processo de correção, F5-T08 em diante) ────────
create table public.essay_jobs (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.essay_versions (id),
  rubric_id uuid not null references public.essay_rubrics (id),
  model_policy_id text not null check (char_length(model_policy_id) between 1 and 80),
  status text not null default 'na_fila' check (status in ('na_fila', 'em_analise', 'pronto', 'nova_tentativa', 'limite_atingido')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 8 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.guard_essay_job() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.essay_versions v where v.id = new.version_id and v.status = 'submetida') then
    raise exception 'resolve_job_requires_submitted' using errcode = 'P0001', hint = 'Só versão submetida vai para correção.';
  end if;
  if tg_op = 'UPDATE' and (new.version_id <> old.version_id or new.rubric_id <> old.rubric_id) then
    raise exception 'resolve_job_identity_changed' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger essay_jobs_guard before insert or update on public.essay_jobs
  for each row execute function private.guard_essay_job();

create table public.essay_evaluations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.essay_jobs (id) on delete cascade,
  evaluator_slot text not null check (evaluator_slot in ('A', 'B', 'C')),
  scores jsonb not null check (jsonb_typeof(scores) = 'object'),
  total smallint not null,
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  feedback text check (char_length(feedback) <= 8000 and private.text_is_safe(feedback)),
  model_id text not null check (char_length(model_id) between 1 and 80),
  prompt_version text not null check (char_length(prompt_version) between 1 and 60),
  usage_id uuid,
  created_at timestamptz not null default now(),
  unique (job_id, evaluator_slot)
);

-- Notas: exatamente as competências da rubrica do trabalho, cada uma num degrau permitido; total = soma.
create function private.guard_essay_evaluation() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_rubric uuid; v_allowed smallint[]; v_codes text[]; v_sum int;
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    raise exception 'resolve_evaluation_immutable' using errcode = 'P0001';
  end if;
  select j.rubric_id into v_rubric from public.essay_jobs j where j.id = new.job_id;
  select r.allowed_scores into v_allowed from public.essay_rubrics r where r.id = v_rubric;
  v_codes := array(select d.code from public.rubric_dimensions d where d.rubric_id = v_rubric order by d.code);
  if array(select k from jsonb_object_keys(new.scores) k order by k) is distinct from v_codes then
    raise exception 'resolve_evaluation_competencies' using errcode = 'P0001', hint = 'Notas exigem exatamente as competências da rubrica.';
  end if;
  if exists (select 1 from jsonb_each(new.scores) s
             where jsonb_typeof(s.value) <> 'number' or not ((s.value)::text::smallint = any (v_allowed)) or (s.value)::text ~ '\.') then
    raise exception 'resolve_evaluation_score_step' using errcode = 'P0001', hint = 'Cada nota precisa ser um dos degraus da rubrica.';
  end if;
  select sum((s.value)::text::int) into v_sum from jsonb_each(new.scores) s;
  if v_sum <> new.total then
    raise exception 'resolve_evaluation_total' using errcode = 'P0001', hint = 'Total diferente da soma das competências.';
  end if;
  return new;
end;
$$;
create trigger essay_evaluations_guard before insert or update or delete on public.essay_evaluations
  for each row execute function private.guard_essay_evaluation();

create table public.essay_results (
  job_id uuid primary key references public.essay_jobs (id) on delete cascade,
  aggregation_version text not null check (char_length(aggregation_version) between 1 and 60),
  evaluator_lower smallint not null check (evaluator_lower between 0 and 1000),
  evaluator_upper smallint not null check (evaluator_upper between 0 and 1000),
  calibrated_lower smallint check (calibrated_lower between 0 and 1000),
  calibrated_upper smallint check (calibrated_upper between 0 and 1000),
  calibration_run_id uuid,
  status text not null default 'nao_calibrado' check (status in ('nao_calibrado', 'calibrado')),
  created_at timestamptz not null default now(),
  check (evaluator_lower <= evaluator_upper),
  -- faixa calibrada só com execução de calibração registrada; sem ela, o resultado é rotulado como não calibrado
  check ((status = 'calibrado') = (calibration_run_id is not null and calibrated_lower is not null and calibrated_upper is not null)),
  check (calibrated_lower is null or calibrated_lower <= calibrated_upper)
);

create table public.essay_annotations (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.essay_evaluations (id) on delete cascade,
  competency text not null check (competency ~ '^C[1-9]$'),
  intervention_element text check (intervention_element in ('agente', 'acao', 'meio', 'finalidade', 'detalhamento')),
  absent boolean not null default false,
  paragraph_id text,
  start_utf16 integer,
  end_utf16 integer,
  comment text not null check (char_length(comment) between 1 and 2000 and private.text_is_safe(comment)),
  created_at timestamptz not null default now(),
  -- ausência é indicada sem trecho; trecho presente aponta um intervalo válido
  check ((absent and paragraph_id is null and start_utf16 is null and end_utf16 is null)
      or (not absent and paragraph_id is not null and start_utf16 >= 0 and end_utf16 > start_utf16))
);

-- Trecho anotado existe no parágrafo da versão avaliada (offsets UTF-16).
create function private.guard_essay_annotation() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_text text;
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    raise exception 'resolve_annotation_immutable' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rubric_dimensions d join public.essay_jobs j on j.rubric_id = d.rubric_id
                 join public.essay_evaluations ev on ev.job_id = j.id where ev.id = new.evaluation_id and d.code = new.competency) then
    raise exception 'resolve_annotation_competency' using errcode = 'P0001';
  end if;
  if not new.absent then
    select p->>'text' into v_text
    from public.essay_evaluations ev join public.essay_jobs j on j.id = ev.job_id
    join public.essay_versions v on v.id = j.version_id
    cross join lateral jsonb_array_elements(v.paragraphs_json) p
    where ev.id = new.evaluation_id and p->>'id' = new.paragraph_id limit 1;
    if v_text is null then
      raise exception 'resolve_annotation_paragraph_missing' using errcode = 'P0001';
    end if;
    if new.end_utf16 > private.utf16_length(v_text) then
      raise exception 'resolve_annotation_out_of_range' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger essay_annotations_guard before insert or update or delete on public.essay_annotations
  for each row execute function private.guard_essay_annotation();

-- ── Acesso ────────────────────────────────────────────────────────────────────
alter table public.essay_rubrics enable row level security;
alter table public.rubric_dimensions enable row level security;
alter table public.essay_axes enable row level security;
alter table public.essay_prompts enable row level security;
alter table public.motivating_texts enable row level security;
alter table public.essay_layout_profiles enable row level security;
alter table public.essays enable row level security;
alter table public.essay_versions enable row level security;
alter table public.essay_jobs enable row level security;
alter table public.essay_evaluations enable row level security;
alter table public.essay_results enable row level security;
alter table public.essay_annotations enable row level security;
revoke all on public.essay_rubrics, public.rubric_dimensions, public.essay_axes, public.essay_prompts, public.motivating_texts,
  public.essay_layout_profiles, public.essays, public.essay_versions, public.essay_jobs, public.essay_evaluations,
  public.essay_results, public.essay_annotations from anon, authenticated;

-- Referência pública para contas: rubrica e perfil da folha.
grant select on public.essay_rubrics, public.rubric_dimensions, public.essay_layout_profiles, public.essay_axes to authenticated;
create policy "rubricas: contas leem" on public.essay_rubrics for select to authenticated using (true);
create policy "competências: contas leem" on public.rubric_dimensions for select to authenticated using (true);
create policy "folha: contas leem" on public.essay_layout_profiles for select to authenticated using (true);
create policy "eixos: contas leem" on public.essay_axes for select to authenticated using (true);

-- Temas: alunos leem publicados; editores leem e escrevem rascunhos.
grant select, insert, update, delete on public.essay_prompts, public.motivating_texts to authenticated;
grant insert, update on public.essay_axes to authenticated;
create policy "eixos: editor escreve" on public.essay_axes for insert to authenticated with check ((select public.is_editor()));
create policy "eixos: editor altera" on public.essay_axes for update to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy "temas: publicados ou editor" on public.essay_prompts for select to authenticated
  using (status = 'published' or (select public.is_editor()));
create policy "temas: editor cria" on public.essay_prompts for insert to authenticated with check ((select public.is_editor()));
create policy "temas: editor altera" on public.essay_prompts for update to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy "temas: editor remove rascunho" on public.essay_prompts for delete to authenticated using ((select public.is_editor()));
create policy "textos motivadores: de tema publicado ou editor" on public.motivating_texts for select to authenticated
  using ((select public.is_editor()) or exists (select 1 from public.essay_prompts p where p.id = motivating_texts.prompt_id and p.status = 'published'));
create policy "textos motivadores: editor cria" on public.motivating_texts for insert to authenticated with check ((select public.is_editor()));
create policy "textos motivadores: editor altera" on public.motivating_texts for update to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy "textos motivadores: editor remove" on public.motivating_texts for delete to authenticated using ((select public.is_editor()));

-- Redações: só a própria conta (nem editor lê).
grant select, insert, delete on public.essays to authenticated;
grant select, insert, update, delete on public.essay_versions to authenticated;
create policy "redações: as próprias" on public.essays for select to authenticated using (user_id = (select auth.uid()));
create policy "redações: criar a própria" on public.essays for insert to authenticated with check (user_id = (select auth.uid()));
create policy "redações: remover a própria" on public.essays for delete to authenticated
  using (user_id = (select auth.uid()) and not exists (select 1 from public.essay_versions v where v.essay_id = essays.id and v.status = 'submetida'));
create policy "versões: das próprias redações" on public.essay_versions for select to authenticated
  using (exists (select 1 from public.essays e where e.id = essay_versions.essay_id and e.user_id = (select auth.uid())));
create policy "versões: criar nas próprias" on public.essay_versions for insert to authenticated
  with check (exists (select 1 from public.essays e where e.id = essay_versions.essay_id and e.user_id = (select auth.uid())));
create policy "versões: editar rascunho próprio" on public.essay_versions for update to authenticated
  using (exists (select 1 from public.essays e where e.id = essay_versions.essay_id and e.user_id = (select auth.uid())))
  with check (exists (select 1 from public.essays e where e.id = essay_versions.essay_id and e.user_id = (select auth.uid())));
create policy "versões: remover rascunho próprio" on public.essay_versions for delete to authenticated
  using (exists (select 1 from public.essays e where e.id = essay_versions.essay_id and e.user_id = (select auth.uid())));

-- Avaliações: leitura pela dona da redação; escrita só pelo processo de correção (sem concessão a clientes).
grant select on public.essay_jobs, public.essay_evaluations, public.essay_results, public.essay_annotations to authenticated;
create policy "correções: das próprias redações" on public.essay_jobs for select to authenticated
  using (exists (select 1 from public.essay_versions v join public.essays e on e.id = v.essay_id
                 where v.id = essay_jobs.version_id and e.user_id = (select auth.uid())));
create policy "avaliações: das próprias redações" on public.essay_evaluations for select to authenticated
  using (exists (select 1 from public.essay_jobs j join public.essay_versions v on v.id = j.version_id join public.essays e on e.id = v.essay_id
                 where j.id = essay_evaluations.job_id and e.user_id = (select auth.uid())));
create policy "resultados: das próprias redações" on public.essay_results for select to authenticated
  using (exists (select 1 from public.essay_jobs j join public.essay_versions v on v.id = j.version_id join public.essays e on e.id = v.essay_id
                 where j.id = essay_results.job_id and e.user_id = (select auth.uid())));
create policy "anotações: das próprias redações" on public.essay_annotations for select to authenticated
  using (exists (select 1 from public.essay_evaluations ev join public.essay_jobs j on j.id = ev.job_id
                 join public.essay_versions v on v.id = j.version_id join public.essays e on e.id = v.essay_id
                 where ev.id = essay_annotations.evaluation_id and e.user_id = (select auth.uid())));

create index rubric_dimensions_rubric on public.rubric_dimensions (rubric_id);
create index essay_rubrics_source on public.essay_rubrics (source_id);
create index essay_prompts_axis on public.essay_prompts (axis_id);
create index essay_prompts_created_by on public.essay_prompts (created_by);
create index motivating_texts_source on public.motivating_texts (source_id);
create index essays_user on public.essays (user_id, created_at desc);
create index essays_prompt on public.essays (prompt_id);
create index essay_versions_essay on public.essay_versions (essay_id, created_at);
create index essay_versions_parent on public.essay_versions (parent_id);
create index essay_versions_layout on public.essay_versions (layout_profile_id);
create index essay_jobs_version on public.essay_jobs (version_id);
create index essay_jobs_rubric on public.essay_jobs (rubric_id);
create index essay_annotations_evaluation on public.essay_annotations (evaluation_id);

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.text_is_safe(text) to authenticated;
grant execute on function private.blocks_are_safe(jsonb) to authenticated;
grant execute on function private.json_strings_are_safe(jsonb) to authenticated;
grant execute on function private.proposal_is_complete(jsonb) to authenticated;
grant execute on function private.utf16_length(text) to authenticated;
grant execute on function private.booklet_for_payload(jsonb) to authenticated;
grant execute on function private.answer_for_payload(jsonb) to authenticated;
grant execute on function private.tag_review_problems(uuid, jsonb, jsonb) to authenticated;
grant execute on function private.publication_blockers(uuid) to authenticated;
grant execute on function private.essay_text_ok(text) to authenticated;
