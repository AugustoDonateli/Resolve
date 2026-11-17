-- Clube: "convidado" é quem entrou por convite. Conta anterior que só foi suspensa e reativada continua "anterior".
create or replace function public.club_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select public.is_owner()) then
    return null;
  end if;
  return jsonb_build_object(
    'seats_left', private.club_seats_left(),
    'invites', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'code', i.code, 'note', i.note, 'max_uses', i.max_uses, 'uses', i.uses, 'expires_at', i.expires_at,
        'state', private.invite_state(i.code)) order by i.created_at desc), '[]'::jsonb) from public.invites i),
    'accounts', (select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
        'kind', case when o.user_id is not null then 'dono' when m.invite_id is not null then 'convidado' else 'anterior' end,
        'status', case when u.banned_until is not null and u.banned_until > now() then 'suspenso' else coalesce(m.status, 'ativo') end,
        'me', u.id = auth.uid(),
        'ai_limit_usd', bp.limit_usd,
        'ai_consumed_usd', (select coalesce(sum(b.consumed_usd), 0) from public.ai_budgets b where b.policy_id = bp.id and current_date >= b.period_start and current_date < b.period_end),
        'ai_reserved_usd', (select coalesce(sum(b.reserved_usd), 0) from public.ai_budgets b where b.policy_id = bp.id and current_date >= b.period_start and current_date < b.period_end)
      ) order by u.created_at), '[]'::jsonb)
      from auth.users u
      left join public.app_owners o on o.user_id = u.id
      left join public.members m on m.user_id = u.id
      left join public.ai_budget_policies bp on bp.user_id = u.id and bp.scope = 'usuario' and bp.active));
end $$;
