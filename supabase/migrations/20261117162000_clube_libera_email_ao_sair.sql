-- Conta excluída ou removida: o e-mail deixa de estar liberado. Sem isso, a pessoa removida poderia criar a conta
-- de novo pela tela Entrar, sem convite.
create or replace function public.remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_owner()) then
    raise exception 'resolve_not_owner' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.members m where m.user_id = p_user and m.status = 'removendo')
     or exists (select 1 from public.app_owners o where o.user_id = p_user) then
    raise exception 'resolve_member_invalid' using errcode = 'P0001', hint = 'Ponha a conta em remoção antes.';
  end if;
  delete from public.signup_allowlist where email = (select lower(u.email) from auth.users u where u.id = p_user);
  delete from auth.users where id = p_user;
end $$;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.app_owners o where o.user_id = auth.uid()) then
    raise exception 'resolve_owner_cannot_leave' using errcode = 'P0001', hint = 'A conta do dono não é excluída pela tela.';
  end if;
  delete from public.signup_allowlist where email = (select lower(u.email) from auth.users u where u.id = auth.uid());
  delete from auth.users where id = auth.uid();
end $$;
