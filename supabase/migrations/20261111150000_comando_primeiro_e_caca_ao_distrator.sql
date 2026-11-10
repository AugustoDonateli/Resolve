-- Treinos de habilidade: comando primeiro (marca a evidência antes de responder) e caça ao distrator
-- (classifica cada alternativa errada depois de responder). Medidas próprias e separadas do acerto.
-- A comparação com as etiquetas editoriais só sai depois da resposta e só quando as etiquetas foram
-- revisadas; com etiquetas pendentes, o retorno diz que a comparação está indisponível.

alter table public.study_sessions add column skill text check (skill in ('comando', 'distrator'));

create table public.attempt_evidence (
  session_item_id uuid primary key references public.session_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- [{block_id, start_utf16, end_utf16, quote}] (até 3 trechos)
  ranges jsonb not null check (jsonb_typeof(ranges) = 'array' and jsonb_array_length(ranges) <= 3),
  -- quando a resposta não está num trecho do texto (figura, cálculo)
  none_reason text check (none_reason in ('figura', 'calculo', 'nao_encontrei')),
  updated_at timestamptz not null default now(),
  check (jsonb_array_length(ranges) > 0 or none_reason is not null)
);

create table public.attempt_distractor_choices (
  session_item_id uuid primary key references public.session_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- [{key, type, justification}] para cada alternativa errada; type = código da taxonomia ou 'nao_sei'
  choices jsonb not null check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) between 1 and 4),
  created_at timestamptz not null default now()
);

alter table public.attempt_evidence enable row level security;
alter table public.attempt_distractor_choices enable row level security;
grant select on public.attempt_evidence, public.attempt_distractor_choices to authenticated;
create policy "evidência: da própria conta" on public.attempt_evidence for select to authenticated using (user_id = (select auth.uid()));
create policy "distratores: da própria conta" on public.attempt_distractor_choices for select to authenticated using (user_id = (select auth.uid()));

-- Marca o treino da sessão (antes de qualquer resposta).
create function public.set_session_skill(p_session uuid, p_skill text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_skill not in ('comando', 'distrator') then
    raise exception 'resolve_skill_invalid' using errcode = 'P0001';
  end if;
  update public.study_sessions s set skill = p_skill
   where s.id = p_session and s.user_id = auth.uid() and s.skill is null
     and not exists (select 1 from public.attempts a join public.session_items si on si.id = a.session_item_id where si.session_id = s.id);
  if not found then
    raise exception 'resolve_session_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- Grava (ou substitui) a evidência marcada; congela depois da resposta. Cada trecho precisa existir no texto.
create function public.record_evidence(p_session_item uuid, p_ranges jsonb, p_none_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_si public.session_items%rowtype; r jsonb; v_text text; v_blocks jsonb;
begin
  select si.* into v_si from public.session_items si join public.study_sessions s on s.id = si.session_id
   where si.id = p_session_item and s.user_id = auth.uid();
  if not found then
    raise exception 'resolve_session_item_not_found' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.attempts a where a.session_item_id = p_session_item) then
    raise exception 'resolve_already_answered' using errcode = 'P0001', hint = 'A evidência fica congelada depois da resposta.';
  end if;
  if jsonb_typeof(coalesce(p_ranges, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_ranges, '[]'::jsonb)) > 3 then
    raise exception 'resolve_evidence_invalid' using errcode = 'P0001';
  end if;
  select coalesce(sv.blocks_json, '[]'::jsonb) || iv.command_blocks into v_blocks
    from public.item_versions iv left join public.stimulus_versions sv on sv.id = iv.stimulus_version_id
   where iv.id = v_si.item_version_id;
  for r in select * from jsonb_array_elements(coalesce(p_ranges, '[]'::jsonb)) loop
    select b->>'text' into v_text from jsonb_array_elements(v_blocks) b where b->>'id' = r->>'block_id' limit 1;
    if v_text is null or coalesce(r->>'start_utf16', '') !~ '^\d+$' or coalesce(r->>'end_utf16', '') !~ '^\d+$'
       or (r->>'start_utf16')::int >= (r->>'end_utf16')::int or (r->>'end_utf16')::int > private.utf16_length(v_text) then
      raise exception 'resolve_evidence_invalid' using errcode = 'P0001', hint = 'Trecho fora do texto da questão.';
    end if;
  end loop;
  insert into public.attempt_evidence (session_item_id, user_id, ranges, none_reason, updated_at)
  values (p_session_item, auth.uid(), coalesce(p_ranges, '[]'::jsonb), p_none_reason, now())
  on conflict (session_item_id) do update set ranges = excluded.ranges, none_reason = excluded.none_reason, updated_at = now();
  return coalesce(p_ranges, '[]'::jsonb);
end;
$$;

-- Grava a classificação das alternativas erradas, uma vez, depois da resposta.
create function public.record_distractor_choices(p_session_item uuid, p_choices jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_si public.session_items%rowtype; c jsonb; v_correct text;
begin
  select si.* into v_si from public.session_items si join public.study_sessions s on s.id = si.session_id
   where si.id = p_session_item and s.user_id = auth.uid();
  if not found then
    raise exception 'resolve_session_item_not_found' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.attempts a where a.session_item_id = p_session_item) then
    raise exception 'resolve_not_answered' using errcode = 'P0001', hint = 'Classifique depois de responder.';
  end if;
  if exists (select 1 from public.attempt_distractor_choices d where d.session_item_id = p_session_item) then
    return; -- reenvio inofensivo
  end if;
  select al.stable_key into v_correct from public.alternatives al where al.item_version_id = v_si.item_version_id and al.is_correct;
  for c in select * from jsonb_array_elements(coalesce(p_choices, '[]'::jsonb)) loop
    if c->>'key' = v_correct or not exists (select 1 from public.alternatives al where al.item_version_id = v_si.item_version_id and al.stable_key = c->>'key')
       or not (c->>'type' = 'nao_sei' or exists (select 1 from public.distractor_types t where t.code = c->>'type'))
       or char_length(coalesce(c->>'justification', '')) > 500 then
      raise exception 'resolve_choice_invalid' using errcode = 'P0001';
    end if;
  end loop;
  insert into public.attempt_distractor_choices (session_item_id, user_id, choices) values (p_session_item, auth.uid(), p_choices);
end;
$$;

-- Retorno dos treinos, só depois da resposta: o que o aluno marcou e, se revisadas, as etiquetas editoriais.
create function public.skill_feedback(p_session_item uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_si public.session_items%rowtype; v_status text;
begin
  select si.* into v_si from public.session_items si join public.study_sessions s on s.id = si.session_id
   where si.id = p_session_item and s.user_id = auth.uid();
  if not found then
    raise exception 'resolve_session_item_not_found' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.attempts a where a.session_item_id = p_session_item) then
    return jsonb_build_object('released', false);
  end if;
  select iv.annotation_status into v_status from public.item_versions iv where iv.id = v_si.item_version_id;
  return jsonb_build_object(
    'released', true,
    'annotation_status', v_status,
    'correct_key', (select al.stable_key from public.alternatives al where al.item_version_id = v_si.item_version_id and al.is_correct),
    'my_evidence', (select to_jsonb(e) - 'user_id' - 'session_item_id' from public.attempt_evidence e where e.session_item_id = p_session_item),
    'my_choices', (select d.choices from public.attempt_distractor_choices d where d.session_item_id = p_session_item),
    'evidence', case when v_status = 'aprovadas' then coalesce((
        select jsonb_agg(jsonb_build_object('block_id', ev.block_id, 'start_utf16', ev.start_utf16, 'end_utf16', ev.end_utf16, 'rationale', ev.rationale))
        from public.evidence_annotations ev where ev.item_version_id = v_si.item_version_id and ev.target_type = 'text'), '[]'::jsonb) end,
    'distractors', case when v_status = 'aprovadas' then coalesce((
        select jsonb_agg(jsonb_build_object('key', al.stable_key, 'type', dt.code, 'label', dt.label, 'rationale', aa.rationale))
        from public.alternatives al join public.alternative_annotations aa on aa.alternative_id = al.id and aa.review_status = 'aprovada' and aa.is_primary
        join public.distractor_types dt on dt.id = aa.type_id where al.item_version_id = v_si.item_version_id), '[]'::jsonb) end
  );
end;
$$;

revoke all on function public.set_session_skill(uuid, text), public.record_evidence(uuid, jsonb, text),
  public.record_distractor_choices(uuid, jsonb), public.skill_feedback(uuid) from public, anon;
grant execute on function public.set_session_skill(uuid, text), public.record_evidence(uuid, jsonb, text),
  public.record_distractor_choices(uuid, jsonb), public.skill_feedback(uuid) to authenticated;
