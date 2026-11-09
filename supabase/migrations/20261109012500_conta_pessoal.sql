-- F2-T01 — Conta pessoal: perfis, preferências e cadastro fechado por convite.
-- Plano §4.3 (profiles, user_preferences) e §3 regra 9 (políticas por usuário).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Convites: cadastro fechado inicialmente. Só o dono do banco gerencia esta tabela.
create table public.signup_allowlist (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  invited_at timestamptz not null default now(),
  note text check (char_length(note) <= 200)
);
alter table public.signup_allowlist enable row level security;
revoke all on public.signup_allowlist from anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) between 1 and 64),
  target_exam text not null default 'ENEM 2027' check (char_length(target_exam) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  reduced_motion boolean not null default false,
  text_scale smallint not null default 18 check (text_scale in (18, 20, 22)),
  default_language text check (default_language in ('ingles', 'espanhol')),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

-- Linhas nascem pelo gatilho de cadastro e somem em cascata com a conta.
revoke insert, delete, truncate on public.profiles, public.user_preferences from anon, authenticated;
revoke all on public.profiles, public.user_preferences from anon;

create policy "perfil: ler o próprio" on public.profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "perfil: editar o próprio" on public.profiles
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "preferências: ler as próprias" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "preferências: editar as próprias" on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- updated_at mantido pelo servidor.
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function private.touch_updated_at();

-- Cadastro fechado: recusa e-mail sem convite antes de criar o usuário.
create function private.enforce_signup_allowlist() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or not exists (
    select 1 from public.signup_allowlist a where a.email = lower(new.email)
  ) then
    raise exception 'resolve_signup_closed' using errcode = 'P0001',
      hint = 'Cadastro fechado: este e-mail não tem convite.';
  end if;
  return new;
end;
$$;
create trigger resolve_enforce_signup_allowlist before insert on auth.users
  for each row execute function private.enforce_signup_allowlist();

-- Perfil e preferências padrão para cada conta nova.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger resolve_on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

revoke all on all functions in schema private from public, anon, authenticated;
