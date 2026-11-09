-- Cadastro sem e-mail (pedido de Guto): conta criada já ativa, sem confirmação.
-- O cadastro continua restrito a e-mails liberados em public.signup_allowlist.
-- O cadastro padrão do Supabase Auth (que enviaria e-mail de confirmação) fica bloqueado:
-- contas só nascem por public.create_account.

-- Registro mínimo para limitar tentativas em massa (sem guardar e-mail nem IP).
create table private.account_attempts (at timestamptz not null default now());
create index account_attempts_at on private.account_attempts (at);

-- O gatilho passa a aceitar apenas inserções feitas por create_account.
create or replace function private.enforce_signup_allowlist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('resolve.creating_account', true), '') <> lower(coalesce(new.email, '')) then
    raise exception 'resolve_signup_closed' using errcode = 'P0001',
      hint = 'Contas são criadas pela tela Criar conta do Resolve.';
  end if;
  return new;
end;
$$;

create function public.create_account(p_email text, p_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid := gen_random_uuid();
begin
  -- Limite global: 10 tentativas por minuto.
  delete from private.account_attempts where at < now() - interval '1 hour';
  if (select count(*) from private.account_attempts where at > now() - interval '1 minute') >= 10 then
    return 'rate_limited';
  end if;
  insert into private.account_attempts default values;

  if char_length(coalesce(p_password, '')) < 8 or char_length(p_password) > 72 then
    return 'weak_password';
  end if;
  if position('@' in v_email) < 2 or char_length(v_email) > 254 then
    return 'invalid_email';
  end if;
  if not exists (select 1 from public.signup_allowlist a where a.email = v_email) then
    return 'not_allowed';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    return 'exists';
  end if;

  perform set_config('resolve.creating_account', v_email, true);
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());
  perform set_config('resolve.creating_account', '', true);
  return 'ok';
end;
$$;

revoke all on function public.create_account(text, text) from public;
grant execute on function public.create_account(text, text) to anon, authenticated;
revoke all on table private.account_attempts from public, anon, authenticated;
