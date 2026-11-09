-- F2-T14 — Publicação transacional. Um lote de propostas aprovadas vira itens publicados numa
-- única transação (tudo ou nada). Pré-condições: lote publicável, proposta válida, etiquetas
-- aprovadas para a revisão atual do conteúdo, gabarito oficial, cruzamento com outra cor
-- conferido, figuras recortadas com texto alternativo e item ainda não publicado.
-- O aluno lê o conteúdo publicado sem gabarito, resolução, evidências nem análise de distratores.

-- O que impede publicar (vazio = pode publicar). Invocador: só editores enxergam as propostas.
create function private.publication_blockers(p_id uuid) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  v_p public.item_proposals%rowtype;
  v_publishable boolean;
  v_review public.proposal_tag_reviews%rowtype;
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
    out := array_append(out, format('proposta %s (precisa estar válida, sem dúvida aberta)', v_p.status));
  end if;
  select * into v_review from public.proposal_tag_reviews where proposal_id = p_id order by created_at desc limit 1;
  if not found or v_review.decision <> 'aprovar' then
    out := array_append(out, 'etiquetas não aprovadas');
  elsif v_review.proposal_revision <> v_p.current_revision then
    out := array_append(out, 'conteúdo mudou depois da aprovação das etiquetas');
  else
    -- a aprovação continua válida? (gabarito, figuras e regras podem ter mudado depois)
    out := out || array(select 'etiquetas: ' || x from unnest(private.tag_review_problems(p_id, v_review.tags, v_review.checklist)) x
                        where x <> 'a proposta precisa estar válida (sem dúvida aberta)');
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
  end loop;
  return out;
end;
$$;

-- Fila da tela de publicação: propostas dos lotes, com o que impede cada uma.
create function public.publication_queue()
returns table (proposal_id uuid, batch_id uuid, batch_notes text, publishable boolean, question_number smallint,
               foreign_language text, status text, blockers text[])
language sql stable security invoker set search_path = '' as $$
  select p.id, b.id, b.notes, b.publishable, p.question_number, p.foreign_language, p.status,
         case when p.status in ('valida', 'duvida') then private.publication_blockers(p.id) else '{}'::text[] end
  from public.item_proposals p join public.ingest_batches b on b.id = p.batch_id
  order by b.created_at, p.question_number, p.foreign_language nulls first;
$$;

-- Liga a figura publicada (asset) ao bloco que a referencia.
create function private.attach_assets(blocks jsonb, assets jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(
           case when b ? 'asset_ref' and assets ? (b->>'asset_ref') then b || jsonb_build_object('asset_id', assets->>(b->>'asset_ref')) else b end
           order by ord), '[]'::jsonb)
  from jsonb_array_elements(coalesce(blocks, '[]'::jsonb)) with ordinality as t(b, ord);
$$;

-- Publicação. Definidor (escreve nas tabelas de conteúdo, fechadas para clientes), mas só para editores
-- e só com todas as pré-condições; qualquer falha desfaz o lote inteiro.
create function public.publish_proposals(p_ids uuid[], p_note text)
returns table (proposal_id uuid, item_version_id uuid)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_p public.item_proposals%rowtype;
  v_review public.proposal_tag_reviews%rowtype;
  v_payload jsonb; v_tags jsonb;
  v_blockers text[];
  v_booklet uuid; v_source uuid; v_answer text; v_area uuid; v_fp text;
  v_assets jsonb; v_asset uuid; f jsonb;
  v_stim jsonb; v_cmd jsonb; v_steps jsonb;
  v_item uuid; v_sv uuid; v_iv uuid; v_bi uuid; v_alt uuid;
  v_alts jsonb; k text; vc record; e jsonb; d jsonb;
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

  foreach v_id in array p_ids loop
    select * into v_p from public.item_proposals where id = v_id for update;
    v_blockers := private.publication_blockers(v_id);
    if cardinality(v_blockers) > 0 then
      raise exception 'resolve_publication_blocked' using errcode = 'P0001',
        hint = format('Questão %s: %s', coalesce(v_p.question_number::text, '?'), array_to_string(v_blockers, '; '));
    end if;

    v_payload := v_p.payload;
    select r.* into v_review from public.proposal_tag_reviews r where r.proposal_id = v_id order by r.created_at desc limit 1;
    v_tags := v_review.tags;
    v_booklet := private.booklet_for_payload(v_payload);
    select b.source_id into v_source from public.booklets b where b.id = v_booklet;
    v_answer := private.answer_for_payload(v_payload);
    select a.id into v_area from public.areas a join public.matrix_versions mv on mv.id = a.matrix_version_id
     where a.code = v_payload->>'area' and mv.status = 'published';
    select vc2.fingerprint into v_fp from public.variant_checks vc2
     where vc2.base_booklet_id = v_booklet and vc2.base_position = v_p.question_number
       and vc2.foreign_language is not distinct from v_p.foreign_language and vc2.result = 'confere' limit 1;

    -- Figuras: um asset por recorte, apontando para o arquivo no armazenamento.
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
    v_steps := coalesce((select jsonb_agg(jsonb_build_object('id', st->>'id', 'type', 'paragraph', 'text', st->>'text') order by ord)
                         from jsonb_array_elements(v_tags->'explanation'->'steps') with ordinality as t(st, ord)), '[]'::jsonb);

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
                                      content_dependency, explanation_steps, review_status)
    values (v_item, 1, v_sv, v_cmd, v_area, v_p.foreign_language, (v_tags->>'content_dependency')::smallint, v_steps, 'draft')
    returning id into v_iv;

    -- Alternativas na ordem do caderno de origem; a correta vem do gabarito oficial.
    v_alts := '{}'::jsonb;
    foreach k in array array['A', 'B', 'C', 'D', 'E'] loop
      insert into public.alternatives (item_version_id, stable_key, content_blocks, is_correct)
      values (v_iv, k, private.attach_assets(v_payload->'alternatives'->k, v_assets), k = v_answer)
      returning id into v_alt;
      v_alts := v_alts || jsonb_build_object(k, v_alt);
    end loop;

    -- Posição e letras no caderno de origem e em cada cor conferida no cruzamento.
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

    -- Etiquetas aprovadas.
    insert into public.item_skill_tags (item_version_id, skill_id, is_primary, proposed_by, review_status, reviewer_id)
    select v_iv, s.id, true, 'editor', 'aprovada', v_review.reviewer_id from public.skills s
     where s.area_id = v_area and s.code = v_tags->'skill'->>'code';
    if v_tags->'secondary_skill'->>'code' is not null then
      insert into public.item_skill_tags (item_version_id, skill_id, is_primary, proposed_by, review_status, reviewer_id)
      select v_iv, s.id, false, 'editor', 'aprovada', v_review.reviewer_id from public.skills s
       where s.area_id = v_area and s.code = v_tags->'secondary_skill'->>'code';
    end if;
    for e in select * from jsonb_array_elements(coalesce(v_tags->'evidence', '[]'::jsonb)) loop
      if e->>'type' = 'text' then
        insert into public.evidence_annotations (item_version_id, target_type, block_id, start_utf16, end_utf16, rationale)
        values (v_iv, 'text', e->>'block_id', (e->>'start_utf16')::int, (e->>'end_utf16')::int, e->>'rationale');
      else
        insert into public.evidence_annotations (item_version_id, target_type, asset_id, normalized_bbox, rationale)
        values (v_iv, 'figure', (v_assets->>(e->>'figure_id'))::uuid, array[0, 0, 1, 1]::numeric[], e->>'rationale');
      end if;
    end loop;
    for d in select * from jsonb_array_elements(coalesce(v_tags->'distractors', '[]'::jsonb)) loop
      insert into public.alternative_annotations (alternative_id, type_id, is_primary, rationale, review_status)
      select (v_alts->>(d->>'letter'))::uuid, t.id, true, d->>'rationale', 'aprovada' from public.distractor_types t where t.code = d->>'type';
      if d->>'secondary_type' is not null then
        insert into public.alternative_annotations (alternative_id, type_id, is_primary, rationale, review_status)
        select (v_alts->>(d->>'letter'))::uuid, t.id, false, d->>'rationale', 'aprovada' from public.distractor_types t where t.code = d->>'secondary_type';
      end if;
    end loop;

    -- Quem aprovou as etiquetas e quem publicou ficam registrados.
    insert into public.editorial_reviews (entity_type, entity_version_id, reviewer_id, checklist, decision, notes)
    values ('tags', v_iv, v_review.reviewer_id, v_review.checklist, 'aprovar', v_review.notes),
           ('item_version', v_iv, v_uid, jsonb_build_object('publicacao', true, 'proposta', v_id, 'revisao_do_conteudo', v_p.current_revision), 'aprovar', p_note);

    update public.item_versions set review_status = 'published' where id = v_iv;
    update public.item_proposals set status = 'promovida', promoted_item_version_id = v_iv where id = v_id;

    proposal_id := v_id;
    item_version_id := v_iv;
    return next;
  end loop;
end;
$$;
revoke all on function public.publish_proposals(uuid[], text) from public, anon;
grant execute on function public.publish_proposals(uuid[], text) to authenticated;
revoke all on function public.publication_queue() from public, anon;
grant execute on function public.publication_queue() to authenticated;

-- Figura de item publicado: qualquer conta lê o arquivo (só o recorte, não o PDF nem o resto do bucket).
create policy "figura publicada: contas leem" on storage.objects for select to authenticated
  using (bucket_id = 'editorial' and exists (select 1 from public.assets a where a.storage_path = objects.name));

-- Conteúdo para estudo: só itens publicados, sem gabarito, resolução, evidências nem distratores.
create view public.study_items with (security_invoker = true) as
select iv.id as item_version_id,
       ar.code as area,
       iv.foreign_language,
       iv.annulled,
       sv.blocks_json as stimulus_blocks,
       iv.command_blocks,
       (select jsonb_agg(jsonb_build_object('key', al.stable_key, 'content_blocks', al.content_blocks) order by al.stable_key)
          from public.alternatives al where al.item_version_id = iv.id) as alternatives,
       (select jsonb_agg(jsonb_build_object('booklet', bk.booklet_number, 'day', bk.day, 'color', bk.color, 'position', bi.position)
                         order by bk.day, bk.booklet_number)
          from public.booklet_items bi join public.booklets bk on bk.id = bi.booklet_id where bi.item_version_id = iv.id) as appearances,
       iv.published_at
from public.item_versions iv
join public.areas ar on ar.id = iv.area_id
left join public.stimulus_versions sv on sv.id = iv.stimulus_version_id
where iv.review_status = 'published';
revoke all on public.study_items from anon, public;
grant select on public.study_items to authenticated;

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
