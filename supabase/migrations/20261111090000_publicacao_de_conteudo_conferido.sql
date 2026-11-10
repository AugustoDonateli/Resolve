-- Publicação de conteúdo conferido com etiquetas pendentes.
-- Guto conferiu as questões extraídas contra os PDFs (texto, sinais, alternativas, figuras, gabarito e fonte).
-- As etiquetas editoriais (habilidade, distratores, evidências e resolução) dependem de revisão própria
-- (sugestão por IA + aprovação do editor) e ainda não existem. Este caminho publica só o que foi conferido:
-- a versão fica marcada com etiquetas pendentes, e o Raio-X mostra esses campos como indisponíveis.
-- Nenhuma etiqueta é criada aqui. A publicação completa (publish_proposals) continua igual.

alter table public.item_versions
  add column annotation_status text not null default 'aprovadas'
  check (annotation_status in ('aprovadas', 'pendentes'));

comment on column public.item_versions.annotation_status is
  'aprovadas: etiquetas editoriais revisadas; pendentes: só o conteúdo oficial foi conferido (sem habilidade, distratores nem resolução).';

-- Impedimentos de conteúdo (sem a exigência de etiquetas aprovadas).
create function private.content_publication_blockers(p_id uuid) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  v_p public.item_proposals%rowtype;
  v_publishable boolean;
  v_booklet uuid; v_answer text; v_fp text;
  f jsonb;
  out text[] := '{}';
begin
  select * into v_p from public.item_proposals where id = p_id;
  if not found then
    return array['proposta não encontrada'];
  end if;
  select publishable into v_publishable from public.ingest_batches where id = v_p.batch_id;
  if not v_publishable then
    out := array_append(out, 'lote de teste: não publicável');
  end if;
  if v_p.status = 'promovida' then
    return array_append(out, 'já publicada');
  end if;
  if v_p.status <> 'valida' then
    out := array_append(out, case v_p.status when 'duvida' then 'proposta com dúvida aberta' when 'rejeitada' then 'proposta rejeitada'
                                              else 'proposta ' || v_p.status end);
  end if;
  v_booklet := private.booklet_for_payload(v_p.payload);
  if v_booklet is null then
    out := array_append(out, 'caderno de origem não registrado');
  end if;
  v_answer := private.answer_for_payload(v_p.payload);
  if v_answer is null or v_answer !~ '^[A-E]$' then
    out := array_append(out, 'gabarito oficial ausente ou anulado');
  end if;
  select vc.fingerprint into v_fp from public.variant_checks vc
   where vc.base_booklet_id = v_booklet and vc.base_position = (v_p.payload->>'number')::int
     and vc.foreign_language is not distinct from (v_p.payload->>'foreign_language') and vc.result = 'confere'
   limit 1;
  if v_fp is null then
    out := array_append(out, 'cruzamento com outra cor não conferido');
  elsif exists (select 1 from public.items i where i.canonical_fingerprint = v_fp) then
    out := array_append(out, 'item já existe no banco (mesma impressão digital)');
  end if;
  for f in select * from jsonb_array_elements(coalesce(v_p.payload->'figures', '[]'::jsonb)) loop
    if not exists (select 1 from storage.objects o where o.bucket_id = 'editorial' and o.name = 'figuras/' || (f->>'png_sha256') || '.png') then
      out := array_append(out, format('figura %s sem arquivo recortado no armazenamento', f->>'id'));
    end if;
    if coalesce(f->'recrop_pending' = 'true'::jsonb, false) then
      out := array_append(out, format('figura %s com recorte pendente', f->>'id'));
    end if;
    if char_length(trim(coalesce(f->>'alt_text', ''))) < 3 then
      out := array_append(out, format('figura %s sem texto alternativo', f->>'id'));
    end if;
  end loop;
  return out;
end;
$$;

create function public.content_publication_queue()
returns table (proposal_id uuid, batch_notes text, question_number smallint, foreign_language text,
               area text, status text, blockers text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_editor() then
    raise exception 'resolve_not_editor' using errcode = 'P0001';
  end if;
  return query
  select p.id, b.notes, p.question_number, p.foreign_language, p.payload->>'area', p.status,
         private.content_publication_blockers(p.id)
    from public.item_proposals p join public.ingest_batches b on b.id = p.batch_id
   where b.publishable and p.status <> 'rejeitada'
   order by b.created_at, p.question_number, p.foreign_language nulls first;
end;
$$;
revoke all on function public.content_publication_queue() from public, anon;
grant execute on function public.content_publication_queue() to authenticated;

-- Publica conteúdo conferido. O editor confirma o checklist de conteúdo do lote; a confirmação fica registrada
-- em editorial_reviews com o editor da sessão. Tudo ou nada: um impedimento cancela o lote inteiro.
create function public.publish_conferred_content(p_ids uuid[], p_note text, p_checklist jsonb)
returns table (proposal_id uuid, item_version_id uuid)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_p public.item_proposals%rowtype;
  v_payload jsonb;
  v_blockers text[];
  v_booklet uuid; v_source uuid; v_answer text; v_area uuid; v_fp text;
  v_assets jsonb; v_asset uuid; f jsonb;
  v_stim jsonb; v_cmd jsonb;
  v_item uuid; v_sv uuid; v_iv uuid; v_bi uuid; v_alt uuid;
  v_alts jsonb; k text; vc record; c text;
begin
  if v_uid is null or not public.is_editor() then
    raise exception 'resolve_not_editor' using errcode = 'P0001', hint = 'Só editores publicam.';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 50 then
    raise exception 'resolve_publication_size' using errcode = 'P0001', hint = 'Publique de 1 a 50 propostas por vez.';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 3 or not private.text_is_safe(p_note) then
    raise exception 'resolve_publication_note' using errcode = 'P0001', hint = 'Descreva o lote publicado.';
  end if;
  foreach c in array array['texto_conferido', 'sinais_e_formulas', 'ordem_das_alternativas', 'figuras_sem_corte',
                           'texto_alternativo_sem_resposta', 'gabarito_oficial', 'fonte_registrada'] loop
    if coalesce(p_checklist->c, 'false'::jsonb) <> 'true'::jsonb then
      raise exception 'resolve_publication_checklist' using errcode = 'P0001',
        hint = format('Confirme o item do checklist: %s.', c);
    end if;
  end loop;

  foreach v_id in array p_ids loop
    select * into v_p from public.item_proposals where id = v_id for update;
    v_blockers := private.content_publication_blockers(v_id);
    if cardinality(v_blockers) > 0 then
      raise exception 'resolve_publication_blocked' using errcode = 'P0001',
        hint = format('Questão %s: %s', coalesce(v_p.question_number::text, '?'), array_to_string(v_blockers, '; '));
    end if;

    v_payload := v_p.payload;
    v_booklet := private.booklet_for_payload(v_payload);
    select b.source_id into v_source from public.booklets b where b.id = v_booklet;
    v_answer := private.answer_for_payload(v_payload);
    select a.id into v_area from public.areas a join public.matrix_versions mv on mv.id = a.matrix_version_id
     where a.code = v_payload->>'area' and mv.status = 'published';
    select vc2.fingerprint into v_fp from public.variant_checks vc2
     where vc2.base_booklet_id = v_booklet and vc2.base_position = v_p.question_number
       and vc2.foreign_language is not distinct from v_p.foreign_language and vc2.result = 'confere' limit 1;

    v_assets := '{}'::jsonb;
    for f in select * from jsonb_array_elements(coalesce(v_payload->'figures', '[]'::jsonb)) loop
      insert into public.assets (source_id, page, bbox, storage_path, media_type, alt_text, sha256)
      values (v_source, (f->>'page')::smallint,
              array[(f->'bbox_pt'->>0)::numeric, (f->'bbox_pt'->>1)::numeric, (f->'bbox_pt'->>2)::numeric, (f->'bbox_pt'->>3)::numeric],
              'figuras/' || (f->>'png_sha256') || '.png', 'image/png', f->>'alt_text', f->>'png_sha256')
      returning id into v_asset;
      v_assets := v_assets || jsonb_build_object(f->>'id', v_asset);
    end loop;

    v_stim := private.attach_assets(v_payload->'stimulus_blocks', v_assets);
    v_cmd := private.attach_assets(v_payload->'command_blocks', v_assets);

    insert into public.items (canonical_fingerprint) values (v_fp) returning id into v_item;
    v_sv := null;
    if jsonb_array_length(v_stim) > 0 then
      select sv.id into v_sv from public.stimulus_versions sv
       where sv.fingerprint = encode(extensions.digest(convert_to(v_stim::text, 'UTF8'), 'sha256'), 'hex');
      if v_sv is null then
        insert into public.stimulus_versions (source_id, blocks_json, fingerprint)
        values (v_source, v_stim, encode(extensions.digest(convert_to(v_stim::text, 'UTF8'), 'sha256'), 'hex'))
        returning id into v_sv;
      end if;
    end if;

    insert into public.item_versions (item_id, version, stimulus_version_id, command_blocks, area_id, foreign_language,
                                      content_dependency, explanation_steps, review_status, annotation_status)
    values (v_item, 1, v_sv, v_cmd, v_area, v_p.foreign_language, null, '[]'::jsonb, 'draft', 'pendentes')
    returning id into v_iv;

    v_alts := '{}'::jsonb;
    foreach k in array array['A', 'B', 'C', 'D', 'E'] loop
      insert into public.alternatives (item_version_id, stable_key, content_blocks, is_correct)
      values (v_iv, k, private.attach_assets(v_payload->'alternatives'->k, v_assets), k = v_answer)
      returning id into v_alt;
      v_alts := v_alts || jsonb_build_object(k, v_alt);
    end loop;

    insert into public.booklet_items (booklet_id, position, item_version_id, source_page, foreign_language)
    values (v_booklet, v_p.question_number, v_iv, (v_payload->'source'->'pages'->>0)::smallint, v_p.foreign_language)
    returning id into v_bi;
    foreach k in array array['A', 'B', 'C', 'D', 'E'] loop
      insert into public.booklet_alternative_maps (booklet_item_id, item_version_id, printed_letter, alternative_id)
      values (v_bi, v_iv, k, (v_alts->>k)::uuid);
    end loop;
    for vc in select * from public.variant_checks vc3
               where vc3.base_booklet_id = v_booklet and vc3.base_position = v_p.question_number
                 and vc3.foreign_language is not distinct from v_p.foreign_language and vc3.result = 'confere' loop
      insert into public.booklet_items (booklet_id, position, item_version_id, foreign_language)
      values (vc.other_booklet_id, vc.other_position, v_iv, v_p.foreign_language)
      returning id into v_bi;
      foreach k in array array['A', 'B', 'C', 'D', 'E'] loop
        insert into public.booklet_alternative_maps (booklet_item_id, item_version_id, printed_letter, alternative_id)
        values (v_bi, v_iv, vc.letter_map->>k, (v_alts->>k)::uuid);
      end loop;
    end loop;

    insert into public.editorial_reviews (entity_type, entity_version_id, reviewer_id, checklist, decision, notes)
    values ('item_version', v_iv, v_uid,
            p_checklist || jsonb_build_object('publicacao', true, 'proposta', v_id, 'revisao_do_conteudo', v_p.current_revision,
                                              'etiquetas', 'pendentes'),
            'aprovar', p_note);

    update public.item_versions set review_status = 'published' where id = v_iv;
    update public.item_proposals set status = 'promovida', promoted_item_version_id = v_iv where id = v_id;

    proposal_id := v_id;
    item_version_id := v_iv;
    return next;
  end loop;
end;
$$;
revoke all on function public.publish_conferred_content(uuid[], text, jsonb) from public, anon;
grant execute on function public.publish_conferred_content(uuid[], text, jsonb) to authenticated;

-- O Raio-X informa quando as etiquetas ainda não foram revisadas (em vez de só mostrar campos vazios).
create or replace function public.item_explanation(p_session_item_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_si public.session_items%rowtype; v_reason text;
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  select si.* into v_si from public.session_items si join public.study_sessions s on s.id = si.session_id
   where si.id = p_session_item_id and s.user_id = auth.uid();
  if not found then
    raise exception 'resolve_session_item_not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.attempts a where a.session_item_id = v_si.id and a.user_id = auth.uid()) then
    v_reason := 'respondida';
  elsif exists (select 1 from public.attempt_events e where e.session_item_id = v_si.id and e.user_id = auth.uid() and e.event_type = 'ajuda_vista') then
    v_reason := 'ajuda';
  else
    return jsonb_build_object('released', false);
  end if;
  return jsonb_build_object(
    'released', true,
    'reason', v_reason,
    'annotation_status', (select iv.annotation_status from public.item_versions iv where iv.id = v_si.item_version_id),
    'skill', (select jsonb_build_object('code', sk.code, 'description', sk.description)
                from public.item_skill_tags t join public.skills sk on sk.id = t.skill_id
               where t.item_version_id = v_si.item_version_id and t.review_status = 'aprovada' and t.is_primary limit 1),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object('type', ev.target_type, 'block_id', ev.block_id, 'start_utf16', ev.start_utf16,
                                                             'end_utf16', ev.end_utf16, 'asset_id', ev.asset_id, 'rationale', ev.rationale)
                                           order by ev.block_id, ev.start_utf16)
                            from public.evidence_annotations ev where ev.item_version_id = v_si.item_version_id), '[]'::jsonb),
    'distractors', coalesce((select jsonb_agg(jsonb_build_object('key', al.stable_key, 'type', dt.code, 'label', dt.label,
                                                                'rationale', aa.rationale, 'primary', aa.is_primary)
                                              order by al.stable_key, aa.is_primary desc)
                               from public.alternatives al
                               join public.alternative_annotations aa on aa.alternative_id = al.id and aa.review_status = 'aprovada'
                               join public.distractor_types dt on dt.id = aa.type_id
                              where al.item_version_id = v_si.item_version_id), '[]'::jsonb),
    'steps', (select iv.explanation_steps from public.item_versions iv where iv.id = v_si.item_version_id),
    'correct_key', (select al.stable_key from public.alternatives al where al.item_version_id = v_si.item_version_id and al.is_correct)
  );
end;
$$;
