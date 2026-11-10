-- F3-T04 — Raio-X textual. Critério: apenas versão respondida/ajuda explícita libera resolução.
-- Comando (habilidade aprovada), evidências, distratores e resolução comentada revisados. Liberado para a
-- questão da sessão da própria conta somente depois da resposta (tentativa gravada) ou de ajuda pedida
-- (evento ajuda_vista, que também marca a tentativa como feita com ajuda). Antes disso, só {released: false}.
create function public.item_explanation(p_session_item_id uuid) returns jsonb
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
revoke all on function public.item_explanation(uuid) from public, anon;
grant execute on function public.item_explanation(uuid) to authenticated;
