-- F2-T13 — Correção: em PL/pgSQL, `text[] || 'literal'` lê o literal como array e falha.
-- As pendências passam a ser acumuladas com array_append. Mesmo conteúdo e mesmas regras.

create or replace function private.tag_review_problems(p_proposal uuid, p_tags jsonb, p_checklist jsonb) returns text[]
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
    out := array_append(out, 'a proposta precisa estar válida (sem dúvida aberta)');
  end if;
  v_answer := private.answer_for_payload(v_payload);
  if v_answer is null then
    out := array_append(out, 'gabarito oficial ausente para esta questão');
  elsif v_answer = 'ANULADO' then
    out := array_append(out, 'questão anulada no gabarito oficial: fica fora da publicação');
  end if;

  -- Habilidade (da área da questão, na matriz publicada)
  if v_skill is null or not exists (
    select 1 from public.skills s join public.areas a on a.id = s.area_id join public.matrix_versions mv on mv.id = a.matrix_version_id
    where mv.status = 'published' and a.code = v_payload->>'area' and s.code = v_skill) then
    out := array_append(out, 'habilidade principal ausente ou fora da área');
  end if;
  if v_skill2 is not null and (v_skill2 = v_skill or not exists (
    select 1 from public.skills s join public.areas a on a.id = s.area_id join public.matrix_versions mv on mv.id = a.matrix_version_id
    where mv.status = 'published' and a.code = v_payload->>'area' and s.code = v_skill2)) then
    out := array_append(out, 'habilidade secundária inválida (fora da área ou igual à principal)');
  end if;

  if coalesce(p_tags->>'content_dependency', '') !~ '^[0-3]$' then
    out := array_append(out, 'dependência de conteúdo (0 a 3) não informada');
  end if;

  -- Assunto: lista de assuntos ou justificativa de ausência
  if jsonb_array_length(coalesce(p_tags->'subjects'->'ids', '[]'::jsonb)) = 0 then
    if char_length(trim(coalesce(p_tags->'subjects'->>'absent_reason', ''))) < 10 then
      out := array_append(out, 'assunto ausente sem justificativa');
    end if;
  elsif exists (select 1 from jsonb_array_elements_text(p_tags->'subjects'->'ids') sid
                where not exists (select 1 from public.subjects s where s.id::text = sid)) then
    out := array_append(out, 'assunto inexistente');
  end if;

  -- Evidências
  if jsonb_array_length(coalesce(p_tags->'evidence', '[]'::jsonb)) = 0
     and char_length(trim(coalesce(p_tags->>'evidence_absent_reason', ''))) < 10 then
    out := array_append(out, 'nenhuma evidência e nenhuma justificativa da ausência');
  end if;
  for e in select * from jsonb_array_elements(coalesce(p_tags->'evidence', '[]'::jsonb)) loop
    if e->>'type' = 'text' then
      select b->>'text' into v_text
      from jsonb_array_elements(coalesce(v_payload->'stimulus_blocks', '[]'::jsonb) || coalesce(v_payload->'command_blocks', '[]'::jsonb)) b
      where b->>'id' = e->>'block_id' limit 1;
      if v_text is null then
        out := array_append(out, format('evidência em bloco inexistente (%s)', e->>'block_id'));
      else
        v_len := private.utf16_length(v_text);
        if coalesce(e->>'start_utf16', '') !~ '^\d+$' or coalesce(e->>'end_utf16', '') !~ '^\d+$'
           or (e->>'start_utf16')::int >= (e->>'end_utf16')::int or (e->>'end_utf16')::int > v_len then
          out := array_append(out, format('evidência com posição inválida no bloco %s', e->>'block_id'));
        elsif coalesce(e->>'quote', '') = '' or position(e->>'quote' in v_text) = 0 then
          out := array_append(out, format('trecho da evidência não está no bloco %s', e->>'block_id'));
        end if;
      end if;
    elsif e->>'type' = 'figure' then
      if not exists (select 1 from jsonb_array_elements(coalesce(v_payload->'figures', '[]'::jsonb)) f2 where f2->>'id' = e->>'figure_id') then
        out := array_append(out, format('evidência em figura inexistente (%s)', e->>'figure_id'));
      end if;
    else
      out := array_append(out, 'tipo de evidência desconhecido');
    end if;
    if char_length(trim(coalesce(e->>'rationale', ''))) < 10 then
      out := array_append(out, 'evidência sem justificativa');
    end if;
  end loop;

  -- Distratores: exatamente as letras erradas, tipo da taxonomia e justificativa editorial
  if v_answer ~ '^[A-E]$' then
    v_wrong := array(select l from unnest(array['A', 'B', 'C', 'D', 'E']) l where l <> v_answer order by l);
    v_letters := array(select x->>'letter' from jsonb_array_elements(coalesce(p_tags->'distractors', '[]'::jsonb)) x order by 1);
    if v_letters is distinct from v_wrong then
      out := array_append(out, format('distratores devem cobrir exatamente as letras %s', array_to_string(v_wrong, ', ')));
    end if;
    for d in select * from jsonb_array_elements(coalesce(p_tags->'distractors', '[]'::jsonb)) loop
      if not exists (select 1 from public.distractor_types t where t.code = d->>'type') then
        out := array_append(out, format('alternativa %s sem tipo de distrator', d->>'letter'));
      end if;
      if d->>'secondary_type' is not null and (d->>'secondary_type' = d->>'type'
         or not exists (select 1 from public.distractor_types t where t.code = d->>'secondary_type')) then
        out := array_append(out, format('alternativa %s com tipo secundário inválido', d->>'letter'));
      end if;
      if char_length(trim(coalesce(d->>'rationale', ''))) < 10 then
        out := array_append(out, format('alternativa %s sem justificativa do distrator', d->>'letter'));
      end if;
    end loop;
  end if;

  -- Resolução comentada: passos ou justificativa de ausência
  if jsonb_array_length(coalesce(p_tags->'explanation'->'steps', '[]'::jsonb)) = 0 then
    if char_length(trim(coalesce(p_tags->'explanation'->>'absent_reason', ''))) < 10 then
      out := array_append(out, 'resolução ausente sem justificativa');
    end if;
  elsif exists (select 1 from jsonb_array_elements(p_tags->'explanation'->'steps') st
                where coalesce(st->>'id', '') !~ '^[a-z0-9_-]{1,24}$' or char_length(trim(coalesce(st->>'text', ''))) = 0) then
    out := array_append(out, 'passo de resolução vazio ou sem identificador');
  end if;

  -- Figuras: recorte em dia e texto alternativo
  for f in select * from jsonb_array_elements(coalesce(v_payload->'figures', '[]'::jsonb)) loop
    if coalesce(f->'recrop_pending' = 'true'::jsonb, false) then
      out := array_append(out, format('figura %s com recorte pendente', f->>'id'));
    end if;
    if char_length(trim(coalesce(f->>'alt_text', ''))) < 3 then
      out := array_append(out, format('figura %s sem texto alternativo', f->>'id'));
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
      out := array_append(out, ('checklist: ' || c.label));
    end if;
  end loop;

  if not private.json_strings_are_safe(p_tags) then
    out := array_append(out, 'texto inseguro nas etiquetas');
  end if;
  return out;
end;
$$;

revoke all on function private.tag_review_problems(uuid, jsonb, jsonb) from public, anon;
grant execute on function private.tag_review_problems(uuid, jsonb, jsonb) to authenticated;
