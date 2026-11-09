-- F2-T13 — Revisão editorial de etiquetas: formulário + checklist; aprovar exige os campos
-- aplicáveis ou justificativa de ausência. A sugestão de IA (F2-T11) é opcional: o editor pode
-- preencher tudo à mão. Também traz para o banco o que a revisão e a publicação precisam:
-- aplicação e cadernos, gabaritos oficiais e o cruzamento entre cores (F2-T10).

-- ── Aplicação e cadernos (a partir das fontes já registradas na F2-T06) ───────────
insert into public.applications (year, type, label, profile_id)
select 2025, 'regular', 'Enem 2025 · aplicação regular', p.id
from public.exam_profiles p where p.label = 'Enem 2025 · aplicação regular (referência)'
on conflict (year, type, label) do nothing;

insert into public.booklets (application_id, day, booklet_number, color, variant, source_id, answer_key_source_id)
select a.id, substr(s.metadata->>'day_code', 2)::smallint, (s.metadata->>'booklet')::smallint, s.metadata->>'color',
       s.metadata->>'variant', s.id, g.id
from public.sources s
join public.applications a on a.year = 2025 and a.type = 'regular' and a.label = 'Enem 2025 · aplicação regular'
left join public.sources g on g.kind = 'gabarito' and g.metadata->>'manifest' = s.metadata->>'manifest'
  and g.metadata->>'day_code' = s.metadata->>'day_code' and g.metadata->>'booklet' = s.metadata->>'booklet'
  and g.metadata->>'variant' = s.metadata->>'variant'
where s.kind = 'prova' and s.metadata->>'application' = 'regular' and s.metadata->>'manifest' = 'data/manifests/enem-2025.json'
on conflict (application_id, day, booklet_number, variant) do nothing;

-- Questões 1–5 do dia 1 têm duas versões na mesma posição (inglês e espanhol).
alter table public.booklet_items add column foreign_language text check (foreign_language in ('ingles', 'espanhol'));
alter table public.booklet_items drop constraint booklet_items_booklet_id_position_key;
create unique index booklet_items_position on public.booklet_items (booklet_id, position, coalesce(foreign_language, '-'));

-- Lotes de teste nunca são publicados.
alter table public.ingest_batches add column publishable boolean not null default true;
update public.ingest_batches set publishable = false
 where notes like 'lote de teste automatizado%' or notes = 'matriz de acesso (teste automatizado)';

-- ── Gabaritos oficiais (por caderno) ──────────────────────────────────────────
create table public.official_answer_keys (
  booklet_id uuid not null references public.booklets (id),
  question_number smallint not null check (question_number between 1 and 180),
  foreign_language text check (foreign_language in ('ingles', 'espanhol')),
  answer text not null check (answer in ('A', 'B', 'C', 'D', 'E', 'ANULADO')),
  source_id uuid not null references public.sources (id),
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
create unique index official_answer_keys_unique on public.official_answer_keys (booklet_id, question_number, coalesce(foreign_language, '-'));
create index official_answer_keys_source on public.official_answer_keys (source_id);
create index official_answer_keys_created_by on public.official_answer_keys (created_by);

-- ── Cruzamento entre cores (saída de tools/ingest/crossmatch.py) ──────────────────
create table public.variant_checks (
  id uuid primary key default gen_random_uuid(),
  base_booklet_id uuid not null references public.booklets (id),
  base_position smallint not null check (base_position between 1 and 180),
  foreign_language text check (foreign_language in ('ingles', 'espanhol')),
  other_booklet_id uuid not null references public.booklets (id),
  other_position smallint not null check (other_position between 1 and 180),
  letter_map jsonb not null check (jsonb_typeof(letter_map) = 'object'),
  result text not null check (result in ('confere', 'anulada_nas_duas', 'anulacao_divergente', 'diverge', 'gabarito_ausente', 'letra_nao_mapeavel', 'sem_par')),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  tool text not null check (char_length(tool) between 1 and 200),
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  check (base_booklet_id <> other_booklet_id),
  -- "confere" só com as cinco letras mapeadas, sem repetição
  check (result <> 'confere' or letter_map ?& array['A', 'B', 'C', 'D', 'E'])
);
create unique index variant_checks_unique on public.variant_checks (base_booklet_id, base_position, coalesce(foreign_language, '-'), other_booklet_id);
create index variant_checks_other on public.variant_checks (other_booklet_id);
create index variant_checks_created_by on public.variant_checks (created_by);

create trigger official_answer_keys_append_only before update or delete on public.official_answer_keys
  for each row execute function private.block_update();
create trigger variant_checks_append_only before update or delete on public.variant_checks
  for each row execute function private.block_update();

-- ── Funções de apoio ──────────────────────────────────────────────────────────
create function private.booklet_for_payload(p jsonb) returns uuid
language sql stable set search_path = '' as $$
  select b.id from public.booklets b join public.sources s on s.id = b.source_id
  where s.sha256 = p->'source'->>'booklet_sha256' limit 1;
$$;

create function private.answer_for_payload(p jsonb) returns text
language sql stable set search_path = '' as $$
  select k.answer from public.official_answer_keys k
  where k.booklet_id = private.booklet_for_payload(p)
    and k.question_number = (p->>'number')::int
    and k.foreign_language is not distinct from (p->>'foreign_language')
  limit 1;
$$;

-- Lista de pendências que impedem aprovar (vazia = pode aprovar). Usada pelo gatilho e pela tela.
create function private.tag_review_problems(p_proposal uuid, p_tags jsonb, p_checklist jsonb) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  v_payload jsonb; v_status text; v_answer text; v_text text; v_len int;
  e jsonb; d jsonb; f jsonb; c record;
  v_wrong text[]; v_letters text[];
  out text[] := '{}';
  v_skill text := p_tags->'skill'->>'code';
  v_skill2 text := p_tags->'secondary_skill'->>'code';
begin
  select payload, status into v_payload, v_status from public.item_proposals where id = p_proposal;
  if v_payload is null then
    return array['proposta não encontrada'];
  end if;
  if v_status <> 'valida' then
    out := out || 'a proposta precisa estar válida (sem dúvida aberta)';
  end if;
  v_answer := private.answer_for_payload(v_payload);
  if v_answer is null then
    out := out || 'gabarito oficial ausente para esta questão';
  elsif v_answer = 'ANULADO' then
    out := out || 'questão anulada no gabarito oficial: fica fora da publicação';
  end if;

  -- Habilidade (da área da questão, na matriz publicada)
  if v_skill is null or not exists (
    select 1 from public.skills s join public.areas a on a.id = s.area_id join public.matrix_versions mv on mv.id = a.matrix_version_id
    where mv.status = 'published' and a.code = v_payload->>'area' and s.code = v_skill) then
    out := out || 'habilidade principal ausente ou fora da área';
  end if;
  if v_skill2 is not null and (v_skill2 = v_skill or not exists (
    select 1 from public.skills s join public.areas a on a.id = s.area_id join public.matrix_versions mv on mv.id = a.matrix_version_id
    where mv.status = 'published' and a.code = v_payload->>'area' and s.code = v_skill2)) then
    out := out || 'habilidade secundária inválida (fora da área ou igual à principal)';
  end if;

  if coalesce(p_tags->>'content_dependency', '') !~ '^[0-3]$' then
    out := out || 'dependência de conteúdo (0 a 3) não informada';
  end if;

  -- Assunto: lista de assuntos ou justificativa de ausência
  if jsonb_array_length(coalesce(p_tags->'subjects'->'ids', '[]'::jsonb)) = 0 then
    if char_length(trim(coalesce(p_tags->'subjects'->>'absent_reason', ''))) < 10 then
      out := out || 'assunto ausente sem justificativa';
    end if;
  elsif exists (select 1 from jsonb_array_elements_text(p_tags->'subjects'->'ids') sid
                where not exists (select 1 from public.subjects s where s.id::text = sid)) then
    out := out || 'assunto inexistente';
  end if;

  -- Evidências
  if jsonb_array_length(coalesce(p_tags->'evidence', '[]'::jsonb)) = 0
     and char_length(trim(coalesce(p_tags->>'evidence_absent_reason', ''))) < 10 then
    out := out || 'nenhuma evidência e nenhuma justificativa da ausência';
  end if;
  for e in select * from jsonb_array_elements(coalesce(p_tags->'evidence', '[]'::jsonb)) loop
    if e->>'type' = 'text' then
      select b->>'text' into v_text
      from jsonb_array_elements(coalesce(v_payload->'stimulus_blocks', '[]'::jsonb) || coalesce(v_payload->'command_blocks', '[]'::jsonb)) b
      where b->>'id' = e->>'block_id' limit 1;
      if v_text is null then
        out := out || format('evidência em bloco inexistente (%s)', e->>'block_id');
      else
        v_len := private.utf16_length(v_text);
        if coalesce(e->>'start_utf16', '') !~ '^\d+$' or coalesce(e->>'end_utf16', '') !~ '^\d+$'
           or (e->>'start_utf16')::int >= (e->>'end_utf16')::int or (e->>'end_utf16')::int > v_len then
          out := out || format('evidência com posição inválida no bloco %s', e->>'block_id');
        elsif coalesce(e->>'quote', '') = '' or position(e->>'quote' in v_text) = 0 then
          out := out || format('trecho da evidência não está no bloco %s', e->>'block_id');
        end if;
      end if;
    elsif e->>'type' = 'figure' then
      if not exists (select 1 from jsonb_array_elements(coalesce(v_payload->'figures', '[]'::jsonb)) f2 where f2->>'id' = e->>'figure_id') then
        out := out || format('evidência em figura inexistente (%s)', e->>'figure_id');
      end if;
    else
      out := out || 'tipo de evidência desconhecido';
    end if;
    if char_length(trim(coalesce(e->>'rationale', ''))) < 10 then
      out := out || 'evidência sem justificativa';
    end if;
  end loop;

  -- Distratores: exatamente as letras erradas, tipo da taxonomia e justificativa editorial
  if v_answer ~ '^[A-E]$' then
    v_wrong := array(select l from unnest(array['A', 'B', 'C', 'D', 'E']) l where l <> v_answer order by l);
    v_letters := array(select x->>'letter' from jsonb_array_elements(coalesce(p_tags->'distractors', '[]'::jsonb)) x order by 1);
    if v_letters is distinct from v_wrong then
      out := out || format('distratores devem cobrir exatamente as letras %s', array_to_string(v_wrong, ', '));
    end if;
    for d in select * from jsonb_array_elements(coalesce(p_tags->'distractors', '[]'::jsonb)) loop
      if not exists (select 1 from public.distractor_types t where t.code = d->>'type') then
        out := out || format('alternativa %s sem tipo de distrator', d->>'letter');
      end if;
      if d->>'secondary_type' is not null and (d->>'secondary_type' = d->>'type'
         or not exists (select 1 from public.distractor_types t where t.code = d->>'secondary_type')) then
        out := out || format('alternativa %s com tipo secundário inválido', d->>'letter');
      end if;
      if char_length(trim(coalesce(d->>'rationale', ''))) < 10 then
        out := out || format('alternativa %s sem justificativa do distrator', d->>'letter');
      end if;
    end loop;
  end if;

  -- Resolução comentada: passos ou justificativa de ausência
  if jsonb_array_length(coalesce(p_tags->'explanation'->'steps', '[]'::jsonb)) = 0 then
    if char_length(trim(coalesce(p_tags->'explanation'->>'absent_reason', ''))) < 10 then
      out := out || 'resolução ausente sem justificativa';
    end if;
  elsif exists (select 1 from jsonb_array_elements(p_tags->'explanation'->'steps') st
                where coalesce(st->>'id', '') !~ '^[a-z0-9_-]{1,24}$' or char_length(trim(coalesce(st->>'text', ''))) = 0) then
    out := out || 'passo de resolução vazio ou sem identificador';
  end if;

  -- Figuras: recorte em dia e texto alternativo
  for f in select * from jsonb_array_elements(coalesce(v_payload->'figures', '[]'::jsonb)) loop
    if coalesce(f->'recrop_pending' = 'true'::jsonb, false) then
      out := out || format('figura %s com recorte pendente', f->>'id');
    end if;
    if char_length(trim(coalesce(f->>'alt_text', ''))) < 3 then
      out := out || format('figura %s sem texto alternativo', f->>'id');
    end if;
  end loop;

  -- Checklist do critério de publicação (plano §5)
  for c in select * from (values
    ('texto_conferido', 'texto conferido contra o PDF'),
    ('sinais_e_formulas', 'sinais, números e fórmulas conferidos'),
    ('ordem_das_alternativas', 'ordem e letras das alternativas conferidas'),
    ('figuras_sem_corte', 'nenhuma figura com informação cortada'),
    ('texto_alternativo_sem_resposta', 'texto alternativo não revela a resposta'),
    ('gabarito_oficial', 'gabarito conferido contra o oficial'),
    ('fonte_registrada', 'fonte e caderno registrados')) as t(k, label)
  loop
    if coalesce(p_checklist->c.k, 'false'::jsonb) <> 'true'::jsonb then
      out := out || ('checklist: ' || c.label);
    end if;
  end loop;

  if not private.json_strings_are_safe(p_tags) then
    out := out || 'texto inseguro nas etiquetas';
  end if;
  return out;
end;
$$;

-- ── Revisões de etiquetas (registro imutável) ────────────────────────────────
create table public.proposal_tag_reviews (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.item_proposals (id) on delete cascade,
  proposal_revision integer not null check (proposal_revision >= 0),
  decision text not null check (decision in ('aprovar', 'devolver', 'rejeitar')),
  tags jsonb not null default '{}'::jsonb check (jsonb_typeof(tags) = 'object' and private.json_strings_are_safe(tags)),
  checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  notes text check (char_length(notes) <= 4000 and private.text_is_safe(notes)),
  suggestion_id uuid references public.tag_suggestions (id),
  reviewer_id uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  check (decision = 'aprovar' or char_length(trim(coalesce(notes, ''))) >= 10)
);
create index proposal_tag_reviews_proposal on public.proposal_tag_reviews (proposal_id, created_at desc);
create index proposal_tag_reviews_reviewer on public.proposal_tag_reviews (reviewer_id);
create index proposal_tag_reviews_suggestion on public.proposal_tag_reviews (suggestion_id);

create function private.tag_review_apply() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_rev int; v_status text; v_problems text[];
begin
  select current_revision, status into v_rev, v_status from public.item_proposals where id = new.proposal_id for update;
  if v_rev is null then
    raise exception 'resolve_proposal_not_found' using errcode = 'P0001';
  end if;
  if v_status = 'promovida' then
    raise exception 'resolve_proposal_promoted_immutable' using errcode = 'P0001';
  end if;
  if new.proposal_revision <> v_rev then
    raise exception 'resolve_review_stale' using errcode = 'P0001',
      hint = format('A revisão foi feita sobre a revisão %s do conteúdo; a atual é %s.', new.proposal_revision, v_rev);
  end if;
  if new.decision = 'aprovar' then
    v_problems := private.tag_review_problems(new.proposal_id, new.tags, new.checklist);
    if cardinality(v_problems) > 0 then
      raise exception 'resolve_review_incomplete' using errcode = 'P0001', hint = array_to_string(v_problems, '; ');
    end if;
  elsif new.decision = 'rejeitar' then
    update public.item_proposals set status = 'rejeitada' where id = new.proposal_id;
  else -- devolver: vira dúvida aberta, e a proposta deixa de estar válida
    insert into public.doubt_queue (proposal_id, kind) values (new.proposal_id, left('devolvida na revisão de etiquetas: ' || new.notes, 400));
  end if;
  return new;
end;
$$;
create trigger proposal_tag_reviews_apply before insert on public.proposal_tag_reviews
  for each row execute function private.tag_review_apply();
create trigger proposal_tag_reviews_immutable before update or delete on public.proposal_tag_reviews
  for each row execute function private.revision_immutable();

-- Tela: pendências antes de aprovar (só editores enxergam a proposta; para os demais, "não encontrada").
create function public.tag_review_problems(p_proposal uuid, p_tags jsonb, p_checklist jsonb) returns text[]
language sql stable security invoker set search_path = '' as $$
  select private.tag_review_problems(p_proposal, p_tags, p_checklist);
$$;
create function public.official_answer(p_proposal uuid) returns text
language sql stable security invoker set search_path = '' as $$
  select private.answer_for_payload(p.payload) from public.item_proposals p where p.id = p_proposal;
$$;
revoke all on function public.tag_review_problems(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.official_answer(uuid) from public, anon;
grant execute on function public.tag_review_problems(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.official_answer(uuid) to authenticated;

-- ── Acesso: tudo só para editores ─────────────────────────────────────────────
alter table public.official_answer_keys enable row level security;
alter table public.variant_checks enable row level security;
alter table public.proposal_tag_reviews enable row level security;
revoke all on public.official_answer_keys, public.variant_checks, public.proposal_tag_reviews from anon, authenticated;
grant select, insert on public.official_answer_keys, public.variant_checks, public.proposal_tag_reviews to authenticated;
create policy "editor: gabaritos" on public.official_answer_keys for select to authenticated using ((select public.is_editor()));
create policy "editor: registrar gabarito" on public.official_answer_keys for insert to authenticated
  with check ((select public.is_editor()) and created_by = (select auth.uid()));
create policy "editor: cruzamentos" on public.variant_checks for select to authenticated using ((select public.is_editor()));
create policy "editor: registrar cruzamento" on public.variant_checks for insert to authenticated
  with check ((select public.is_editor()) and created_by = (select auth.uid()));
create policy "editor: revisões de etiquetas" on public.proposal_tag_reviews for select to authenticated using ((select public.is_editor()));
create policy "editor: registrar revisão de etiquetas" on public.proposal_tag_reviews for insert to authenticated
  with check ((select public.is_editor()) and reviewer_id = (select auth.uid()));

-- Lote: só editores marcam se é publicável (lotes de teste nascem não publicáveis pelo carregador).
grant update (publishable) on public.ingest_batches to authenticated;
create policy "editor: marcar lote" on public.ingest_batches for update to authenticated
  using ((select public.is_editor())) with check ((select public.is_editor()));

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.text_is_safe(text) to authenticated;
grant execute on function private.blocks_are_safe(jsonb) to authenticated;
grant execute on function private.json_strings_are_safe(jsonb) to authenticated;
grant execute on function private.proposal_is_complete(jsonb) to authenticated;
grant execute on function private.utf16_length(text) to authenticated;
grant execute on function private.booklet_for_payload(jsonb) to authenticated;
grant execute on function private.answer_for_payload(jsonb) to authenticated;
grant execute on function private.tag_review_problems(uuid, jsonb, jsonb) to authenticated;
