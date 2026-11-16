-- Primeira questão do tutorial: deixa de exigir que a conta nunca tenha respondido. Vêm primeiro as ainda não
-- respondidas; quem revê o tutorial muitas vezes acaba repetindo uma, em vez de ficar sem questão.
create or replace function public.first_question() returns table (item_version_id uuid, area text)
language sql stable security definer set search_path = '' as $$
  select si.item_version_id, si.area
  from public.study_items si
  join public.item_response_stats st on st.item_id = si.item_id
  where auth.uid() is not null
    and not si.annulled and si.foreign_language is null
    and st.correct::numeric / st.respondents >= 0.6
    and not jsonb_path_exists(coalesce(si.stimulus_blocks, '[]'::jsonb) || si.command_blocks, '$[*] ? (@.type == "image")')
    and not jsonb_path_exists(si.alternatives, '$[*].content_blocks[*] ? (@.type == "image")')
  order by exists (select 1 from public.attempts a where a.item_id = si.item_id and a.user_id = auth.uid()),
           (si.annotation_status = 'aprovadas') desc, st.correct::numeric / st.respondents desc, si.item_version_id
  limit 1;
$$;
revoke all on function public.first_question() from public, anon;
grant execute on function public.first_question() to authenticated;
