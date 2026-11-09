-- F2-T14 — Texto do impedimento de estado em português ("com dúvida aberta", "rejeitada"), sem o código interno.

create or replace function private.publication_blockers(p_id uuid) returns text[]
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
    out := array_append(out, case v_p.status when 'duvida' then 'proposta com dúvida aberta' when 'rejeitada' then 'proposta rejeitada'
                                              else 'proposta ' || v_p.status end);
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

revoke all on function private.publication_blockers(uuid) from public, anon;
grant execute on function private.publication_blockers(uuid) to authenticated;
