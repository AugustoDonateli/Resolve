-- Sessão 4 do plano v2: o clube. Dono, convites com validade e limite, membros (suspender, reativar, remover com
-- exclusão dos dados), cota pessoal de IA, aceite dos termos e exclusão da própria conta.
-- Quem é o dono fica em app_owners (a linha é criada fora do repositório, como os e-mails liberados).

create table public.app_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_owners enable row level security;
revoke all on public.app_owners from anon, authenticated;
grant select on public.app_owners to authenticated;
create policy "dono: ler a própria linha" on public.app_owners for select to authenticated using (user_id = (select auth.uid()));

create function public.is_owner() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.app_owners o where o.user_id = (select auth.uid()));
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  note text not null default '' check (char_length(note) <= 80 and private.text_is_safe(note)),
  max_uses smallint not null default 1 check (max_uses between 1 and 5),
  uses smallint not null default 0 check (uses >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (uses <= max_uses)
);
alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;

-- Quem entrou por convite. status: ativo, suspenso (não entra) ou removendo (só durante a remoção, para os
-- arquivos pessoais poderem ser apagados pelo dono antes de a conta sair).
create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  invite_id uuid references public.invites (id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'suspenso', 'removendo')),
  joined_at timestamptz not null default now(),
  status_changed_at timestamptz,
  terms_version text check (char_length(terms_version) <= 20),
  terms_accepted_at timestamptz
);
alter table public.members enable row level security;
revoke all on public.members from anon, authenticated;
grant select on public.members to authenticated;
create policy "membro: ler a própria linha" on public.members for select to authenticated using (user_id = (select auth.uid()));

-- O clube tem o dono e até 5 convidados.
create function private.club_seats_left() returns integer
language sql stable security definer set search_path = '' as $$
  select 5 - (select count(*)::int from public.members m where m.invite_id is not null);
$$;

create function public.create_invite(p_note text default '', p_max_uses integer default 1, p_days integer default 7) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_code text; v_try int := 0;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if not (select public.is_owner()) then
    raise exception 'resolve_not_owner' using errcode = 'P0001';
  end if;
  if p_max_uses not between 1 and 5 or p_days not between 1 and 30 then
    raise exception 'resolve_invite_invalid' using errcode = 'P0001', hint = 'De 1 a 5 usos e de 1 a 30 dias.';
  end if;
  if (select count(*) from public.invites i where i.revoked_at is null and i.expires_at > now() and i.uses < i.max_uses) >= 10 then
    raise exception 'resolve_invite_limit' using errcode = 'P0001', hint = 'Até 10 convites abertos ao mesmo tempo.';
  end if;
  loop
    v_code := (select string_agg(substr(v_alpha, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 10));
    exit when not exists (select 1 from public.invites i where i.code = v_code);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'resolve_invite_code' using errcode = 'P0001'; end if;
  end loop;
  insert into public.invites (code, note, max_uses, expires_at, created_by)
  values (v_code, coalesce(trim(p_note), ''), p_max_uses, now() + make_interval(days => p_days), auth.uid());
  return v_code;
end $$;
revoke all on function public.create_invite(text, integer, integer) from public, anon;
grant execute on function public.create_invite(text, integer, integer) to authenticated;

create function public.revoke_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_owner()) then
    raise exception 'resolve_not_owner' using errcode = 'P0001';
  end if;
  update public.invites set revoked_at = now() where id = p_invite and revoked_at is null;
end $$;
revoke all on function public.revoke_invite(uuid) from public, anon;
grant execute on function public.revoke_invite(uuid) to authenticated;

-- Situação de um código, para a tela de convite: ok, invalido, expirado, usado ou cheio.
create function private.invite_state(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when i.revoked_at is not null then 'invalido'
                when i.expires_at <= now() then 'expirado'
                when i.uses >= i.max_uses then 'usado'
                when (select private.club_seats_left()) <= 0 then 'cheio'
                else 'ok' end
      from public.invites i where i.code = upper(trim(coalesce(p_code, '')))), 'invalido');
$$;

create function public.invite_status(p_code text) returns text
language sql stable security definer set search_path = '' as $$
  select private.invite_state(p_code);
$$;
revoke all on function public.invite_status(text) from public;
grant execute on function public.invite_status(text) to anon, authenticated;

-- Criar conta com convite: confere o código, cria a conta (mesma função do cadastro), registra o membro com o
-- aceite dos termos e dá a cota pessoal de IA. Se qualquer passo falha, nada fica gravado.
create function public.create_account_with_invite(p_email text, p_password text, p_code text, p_terms_version text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_state text := private.invite_state(p_code);
  v_invite uuid; v_result text; v_user uuid;
begin
  if v_state <> 'ok' then
    return 'convite_' || v_state;
  end if;
  if coalesce(p_terms_version, '') = '' then
    return 'termos';
  end if;
  if position('@' in v_email) < 2 or char_length(v_email) > 254 then
    return 'invalid_email';
  end if;
  select id into v_invite from public.invites where code = upper(trim(p_code)) for update;
  if (select uses >= max_uses from public.invites where id = v_invite) then
    return 'convite_usado';
  end if;
  insert into public.signup_allowlist (email, note) values (v_email, 'convite') on conflict do nothing;
  v_result := public.create_account(v_email, p_password);
  if v_result <> 'ok' then
    raise exception 'resolve_signup_%', v_result using errcode = 'P0001';
  end if;
  select id into v_user from auth.users where lower(email) = v_email;
  update public.invites set uses = uses + 1 where id = v_invite;
  insert into public.members (user_id, invite_id, terms_version, terms_accepted_at) values (v_user, v_invite, left(p_terms_version, 20), now());
  insert into public.ai_budget_policies (scope, user_id, limit_usd, warn_ratio, source_note)
  values ('usuario', v_user, 1.50, 0.70, 'Plano v2, Frente 7: cerca de US$ 1,50 por pessoa por mês dentro dos US$ 10 do clube.');
  return 'ok';
end $$;
revoke all on function public.create_account_with_invite(text, text, text, text) from public;
grant execute on function public.create_account_with_invite(text, text, text, text) to anon, authenticated;

-- Visão do dono: convites, contas e consumo de IA do mês de cada uma.
create function public.club_overview() returns jsonb
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
        'kind', case when o.user_id is not null then 'dono' when m.user_id is not null then 'convidado' else 'anterior' end,
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
revoke all on function public.club_overview() from public, anon;
grant execute on function public.club_overview() to authenticated;

-- Suspender ou reativar: quem está suspenso não consegue entrar nem renovar a sessão.
create function public.set_member_status(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_owner()) then
    raise exception 'resolve_not_owner' using errcode = 'P0001';
  end if;
  if p_status not in ('ativo', 'suspenso', 'removendo') or p_user = auth.uid() or exists (select 1 from public.app_owners o where o.user_id = p_user) then
    raise exception 'resolve_member_invalid' using errcode = 'P0001', hint = 'O dono não pode ser suspenso nem removido.';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'resolve_member_invalid' using errcode = 'P0001';
  end if;
  insert into public.members (user_id, status, status_changed_at) values (p_user, p_status, now())
  on conflict (user_id) do update set status = excluded.status, status_changed_at = now();
  update auth.users set banned_until = case when p_status = 'ativo' then null else '2999-01-01'::timestamptz end where id = p_user;
end $$;
revoke all on function public.set_member_status(uuid, text) from public, anon;
grant execute on function public.set_member_status(uuid, text) to authenticated;

-- Durante a remoção, o dono pode listar e apagar os arquivos pessoais da conta que está saindo (e só dela).
create policy "pessoal: dono lê arquivos de conta em remoção" on storage.objects for select to authenticated
  using (bucket_id = 'pessoal' and (select public.is_owner())
         and exists (select 1 from public.members m where m.user_id::text = (storage.foldername(name))[1] and m.status = 'removendo'));
create policy "pessoal: dono apaga arquivos de conta em remoção" on storage.objects for delete to authenticated
  using (bucket_id = 'pessoal' and (select public.is_owner())
         and exists (select 1 from public.members m where m.user_id::text = (storage.foldername(name))[1] and m.status = 'removendo'));
create policy "membros: dono lê" on public.members for select to authenticated using ((select public.is_owner()));

-- Remover com exclusão dos dados: a conta precisa estar em remoção (arquivos já apagados pelo app).
create function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_owner()) then
    raise exception 'resolve_not_owner' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.members m where m.user_id = p_user and m.status = 'removendo')
     or exists (select 1 from public.app_owners o where o.user_id = p_user) then
    raise exception 'resolve_member_invalid' using errcode = 'P0001', hint = 'Ponha a conta em remoção antes.';
  end if;
  delete from auth.users where id = p_user;
end $$;
revoke all on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;

-- Excluir a própria conta: apaga a conta e, em cascata, todos os dados pessoais. O dono não se exclui por aqui.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.app_owners o where o.user_id = auth.uid()) then
    raise exception 'resolve_owner_cannot_leave' using errcode = 'P0001', hint = 'A conta do dono não é excluída pela tela.';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Cota pessoal de IA do mês: limite, consumido, reservado e a partir de quanto avisa. Null sem cota pessoal.
create function public.my_ai_quota() returns jsonb
language sql stable security definer set search_path = '' as $$
  select (
    select jsonb_build_object(
      'limit_usd', bp.limit_usd, 'warn_ratio', bp.warn_ratio,
      'consumed_usd', (select coalesce(sum(b.consumed_usd), 0) from public.ai_budgets b where b.policy_id = bp.id and current_date >= b.period_start and current_date < b.period_end),
      'reserved_usd', (select coalesce(sum(b.reserved_usd), 0) from public.ai_budgets b where b.policy_id = bp.id and current_date >= b.period_start and current_date < b.period_end))
      from public.ai_budget_policies bp
     where bp.scope = 'usuario' and bp.active and bp.user_id = auth.uid());
$$;
revoke all on function public.my_ai_quota() from public, anon;
grant execute on function public.my_ai_quota() to authenticated;

-- Teto do clube: US$ 10 por mês (plano v2, Frente 7). O limite antigo de US$ 5 era o da conta única.
update public.ai_budget_policies set limit_usd = 10 where scope = 'global' and active;
update public.ai_budgets b set limit_usd = 10
  from public.ai_budget_policies p where p.id = b.policy_id and p.scope = 'global' and p.active and current_date >= b.period_start and current_date < b.period_end;
revoke all on function private.club_seats_left(), private.invite_state(text) from public, anon, authenticated;
