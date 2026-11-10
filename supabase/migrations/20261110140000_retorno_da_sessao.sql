-- F3-T02 — Retorno da sessão: para as questões já respondidas na sessão (e só para elas), a alternativa
-- escolhida, a correta e a entrada aberta no caderno. Permite recarregar a tela sem perder a resposta e sem
-- expor gabarito de questão ainda não respondida (plano §3, regra 1).
create function public.session_feedback(p_session_id uuid)
returns table (session_item_id uuid, attempt_id uuid, chosen_alternative_id uuid, correct_alternative_id uuid,
               is_correct boolean, error_entry_id uuid, error_reason text)
language sql stable security definer set search_path = '' as $$
  select si.id, a.id, a.chosen_alternative_id, al.id, a.is_correct, ee.id, ee.reason
  from public.study_sessions s
  join public.session_items si on si.session_id = s.id
  join public.attempts a on a.session_item_id = si.id and a.user_id = s.user_id
  left join public.alternatives al on al.item_version_id = si.item_version_id and al.is_correct
  left join public.error_entries ee on ee.user_id = s.user_id and ee.item_id = a.item_id and ee.resolved_at is null
  where s.id = p_session_id and s.user_id = auth.uid();
$$;
revoke all on function public.session_feedback(uuid) from public, anon;
grant execute on function public.session_feedback(uuid) to authenticated;
