-- Polimento P6: perfil de aprendizado da própria conta, a partir das anotações aprovadas das questões.
-- Usa só a primeira tentativa de cada questão, sem ajuda. Para cada área e cada tema: quantas a conta respondeu
-- e acertou e, nas mesmas questões, quanto acertou em média quem fez a prova (microdados do Inep). Para os
-- erros: o tipo (taxonomia de distratores) da alternativa que a conta marcou.
-- As anotações e as taxas não são legíveis por contas comuns; aqui saem só somas das questões já respondidas.
create function public.learning_profile() returns jsonb
language sql stable security definer set search_path = '' as $$
  with a as (
    select distinct on (at.item_id) at.item_id, at.item_version_id, at.is_correct, at.chosen_alternative_id
      from public.attempts at
     where at.user_id = auth.uid() and not at.is_repeat and not at.help_seen and at.is_correct is not null
     order by at.item_id, at.submitted_at
  ),
  q as (
    select a.*, ar.code as area,
           (select st.correct::numeric / nullif(st.respondents, 0) from public.item_response_stats st
             where st.item_id = a.item_id order by st.respondents desc limit 1) as brazil
      from a
      join public.item_versions iv on iv.id = a.item_version_id
      join public.areas ar on ar.id = iv.area_id
  ),
  areas as (
    select area, count(*) as answers, count(*) filter (where is_correct) as correct,
           count(brazil) as with_brazil, coalesce(sum(brazil), 0) as brazil_sum,
           count(*) filter (where is_correct and brazil is not null) as correct_with_brazil
      from q group by area
  ),
  tagged as (
    select q.area, q.is_correct, q.brazil,
           case when s.kind = 'assunto' then gp.parent_id else s.parent_id end as theme_id
      from q
      join public.item_subject_tags t on t.item_version_id = q.item_version_id and t.is_primary and t.review_status = 'aprovada'
      join public.subjects s on s.id = t.subject_id
      left join public.subjects gp on gp.id = s.parent_id
  ),
  themes as (
    select tg.area, th.code, th.label, d.label as discipline, count(*) as answers, count(*) filter (where tg.is_correct) as correct,
           count(tg.brazil) as with_brazil, coalesce(sum(tg.brazil), 0) as brazil_sum,
           count(*) filter (where tg.is_correct and tg.brazil is not null) as correct_with_brazil
      from tagged tg
      join public.subjects th on th.id = tg.theme_id
      left join public.subjects d on d.id = th.parent_id and d.kind = 'disciplina'
     group by tg.area, th.code, th.label, d.label
  ),
  wrong as (
    select dt.code, dt.label, dt.definition, count(*) as n
      from q
      join public.alternative_annotations aa on aa.alternative_id = q.chosen_alternative_id and aa.is_primary and aa.review_status = 'aprovada'
      join public.distractor_types dt on dt.id = aa.type_id
     where not q.is_correct
     group by dt.code, dt.label, dt.definition
  )
  select case when auth.uid() is null then null else jsonb_build_object(
    'areas', (select coalesce(jsonb_agg(to_jsonb(areas)), '[]'::jsonb) from areas),
    'themes', (select coalesce(jsonb_agg(to_jsonb(themes) order by themes.code), '[]'::jsonb) from themes),
    'distractors', (select coalesce(jsonb_agg(to_jsonb(wrong) order by wrong.n desc, wrong.code), '[]'::jsonb) from wrong),
    'wrong_total', (select count(*) from q where not is_correct)
  ) end;
$$;
revoke all on function public.learning_profile() from public, anon;
grant execute on function public.learning_profile() to authenticated;
