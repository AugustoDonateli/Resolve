-- Sessão 3 do plano v2: conferência rápida das anotações (editor) e guia de primeiros passos (aluno).

-- ── 1) Conferência das anotações ─────────────────────────────────────────────────────────────────
-- Fila: a proposta mais recente de cada questão, com a posição no caderno azul. Só o editor recebe linhas.
create function public.annotation_review_queue()
returns table (proposal_id uuid, status text, area text, year smallint, "position" smallint, language text, flagged boolean)
language sql stable security definer set search_path = '' as $$
  select q.id, q.status, q.code, q.year, q.position, q.language, q.flagged
  from (
    select distinct on (iv.id) p.id, p.status, ar.code, ap.year, bi.position,
           coalesce(bi.foreign_language, iv.foreign_language) as language,
           jsonb_array_length(coalesce(p.payload->'uncertainties', '[]'::jsonb)) > 0 as flagged
    from public.item_annotation_proposals p
    join public.item_versions iv on iv.id = p.item_version_id
    join public.areas ar on ar.id = iv.area_id
    join public.booklet_items bi on bi.item_version_id = iv.id
    join public.booklets bk on bk.id = bi.booklet_id and bk.color = 'Azul'
    join public.applications ap on ap.id = bk.application_id
    where (select public.is_editor()) and p.status in ('proposta', 'aprovada', 'devolvida')
    order by iv.id, p.created_at desc
  ) q
  order by q.code, q.year, q.position, q.language nulls first;
$$;
revoke all on function public.annotation_review_queue() from public, anon;
grant execute on function public.annotation_review_queue() to authenticated;

-- Ficha de uma proposta: a questão como o aluno vê, o gabarito, a anotação proposta, os nomes da habilidade
-- e do assunto e as marcações reais da prova. Só o editor recebe conteúdo.
create function public.annotation_review(p_proposal uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'status', p.status, 'review_note', p.review_note, 'origin', p.origin,
    'item_version_id', iv.id, 'area', ar.code,
    'year', ap.year, 'position', bi.position, 'day', bk.day, 'booklet', bk.booklet_number, 'color', bk.color,
    'language', coalesce(bi.foreign_language, iv.foreign_language),
    'stimulus_blocks', sv.blocks_json, 'command_blocks', iv.command_blocks,
    'alternatives', (select jsonb_agg(jsonb_build_object('key', al.stable_key, 'content_blocks', al.content_blocks, 'is_correct', al.is_correct)
                                      order by al.stable_key)
                       from public.alternatives al where al.item_version_id = iv.id),
    'payload', p.payload,
    'skill', (select jsonb_build_object('code', sk.code, 'description', sk.description)
                from public.skills sk where sk.area_id = iv.area_id and sk.code = p.payload->>'skill'),
    'skill_secondary', (select jsonb_build_object('code', sk.code, 'description', sk.description)
                          from public.skills sk where sk.area_id = iv.area_id and sk.code = p.payload->>'skill_secondary'),
    'subject', (select jsonb_build_object('code', s.code, 'label', s.label, 'kind', s.kind, 'parent', par.label, 'grandparent', gp.label)
                  from public.subjects s
                  left join public.subjects par on par.id = s.parent_id
                  left join public.subjects gp on gp.id = par.parent_id
                 where s.code = p.payload->>'subject_code'),
    'stats', (select jsonb_build_object('edition', so.edition, 'respondents', st.respondents, 'correct', st.correct, 'blank', st.blank,
                                        'alternatives', st.alternatives, 'alternatives_respondents', st.alternatives_respondents)
                from public.item_response_stats st join public.sources so on so.id = st.source_id
               where st.item_id = iv.item_id order by so.edition desc limit 1)
  )
  from public.item_annotation_proposals p
  join public.item_versions iv on iv.id = p.item_version_id
  join public.areas ar on ar.id = iv.area_id
  left join public.stimulus_versions sv on sv.id = iv.stimulus_version_id
  join public.booklet_items bi on bi.item_version_id = iv.id
  join public.booklets bk on bk.id = bi.booklet_id and bk.color = 'Azul'
  join public.applications ap on ap.id = bk.application_id
  where p.id = p_proposal and (select public.is_editor())
  limit 1;
$$;
revoke all on function public.annotation_review(uuid) from public, anon;
grant execute on function public.annotation_review(uuid) to authenticated;

-- ── 2) Guia de primeiros passos ──────────────────────────────────────────────────────────────────
-- Horas por semana (ficha de identificação) e o que a conta já viu do guia: ficha, primeira questão, tour da
-- mesa e as dicas da primeira vez de cada recurso. Cada chave guarda quando aconteceu.
alter table public.profiles
  add column weekly_hours smallint check (weekly_hours between 1 and 80),
  add column guide jsonb not null default '{}'::jsonb check (jsonb_typeof(guide) = 'object' and pg_column_size(guide) <= 1200);
grant select (weekly_hours, guide), update (weekly_hours, guide) on public.profiles to authenticated;

create function public.mark_guide(p_key text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v jsonb;
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  if p_key not in ('ficha', 'primeira_questao', 'tour', 'dica_triagem', 'dica_ritmo', 'dica_dia_d', 'dica_duelo') then
    raise exception 'resolve_guide_key' using errcode = 'P0001';
  end if;
  update public.profiles set guide = guide || jsonb_build_object(p_key, to_jsonb(now()))
   where user_id = auth.uid() and not (guide ? p_key);
  select guide into v from public.profiles where user_id = auth.uid();
  return v;
end $$;
revoke all on function public.mark_guide(text) from public, anon;
grant execute on function public.mark_guide(text) to authenticated;

-- Rever o tutorial: esquece o que foi visto (as respostas da ficha ficam).
create function public.reset_guide() returns void
language sql security invoker set search_path = '' as $$
  update public.profiles set guide = '{}'::jsonb where user_id = auth.uid();
$$;
revoke all on function public.reset_guide() from public, anon;
grant execute on function public.reset_guide() to authenticated;

-- Primeira questão: uma questão real e fácil (acerto alto na prova, só texto, sem língua estrangeira) que a
-- conta ainda não respondeu; prefere as que já têm a anotação conferida, para o Raio-X vir completo.
-- As taxas de acerto não são legíveis por contas comuns; a função só devolve qual questão abrir.
create function public.first_question() returns table (item_version_id uuid, area text)
language sql stable security definer set search_path = '' as $$
  select si.item_version_id, si.area
  from public.study_items si
  join public.item_response_stats st on st.item_id = si.item_id
  where auth.uid() is not null
    and not si.annulled and si.foreign_language is null
    and st.correct::numeric / st.respondents >= 0.6
    and not exists (select 1 from public.attempts a where a.item_id = si.item_id and a.user_id = auth.uid())
    and not jsonb_path_exists(coalesce(si.stimulus_blocks, '[]'::jsonb) || si.command_blocks, '$[*] ? (@.type == "image")')
    and not jsonb_path_exists(si.alternatives, '$[*].content_blocks[*] ? (@.type == "image")')
  order by (si.annotation_status = 'aprovadas') desc, st.correct::numeric / st.respondents desc, si.item_version_id
  limit 1;
$$;
revoke all on function public.first_question() from public, anon;
grant execute on function public.first_question() to authenticated;
