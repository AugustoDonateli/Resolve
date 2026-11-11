-- Grupos e duelos. Um grupo nasce com um código de convite; cada pessoa entra com um apelido (o perfil
-- não é exposto). Um duelo congela uma lista de questões publicadas; cada participante resolve a mesma
-- lista numa sessão própria. O placar dos outros só aparece depois que você termina (ou o duelo fecha),
-- e mostra apenas apelido, respondidas e acertos. Nada é apagado: sair do grupo marca a data.

create table public.study_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60 and private.text_is_safe(name)),
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.study_group_members (
  group_id uuid not null references public.study_groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 30 and private.text_is_safe(nickname)),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (group_id, user_id)
);

create table public.duels (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  area text check (area in ('LC', 'CH', 'CN', 'MT')),
  item_version_ids uuid[] not null check (cardinality(item_version_ids) between 3 and 20),
  created_at timestamptz not null default now(),
  closes_at timestamptz not null
);
create index duels_group on public.duels (group_id, created_at desc);

create table public.duel_entries (
  duel_id uuid not null references public.duels (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (duel_id, user_id)
);

create function private.is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.study_group_members m
                  where m.group_id = p_group and m.user_id = auth.uid() and m.left_at is null);
$$;

alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.duels enable row level security;
alter table public.duel_entries enable row level security;
-- Leitura pelas políticas; escrita só pelas funções abaixo.
grant select on public.study_groups, public.study_group_members, public.duels, public.duel_entries to authenticated;
create policy "grupo: membros leem" on public.study_groups for select to authenticated using ((select private.is_group_member(id)));
create policy "membros: membros do grupo leem" on public.study_group_members for select to authenticated
  using ((select private.is_group_member(group_id)));
create policy "duelos: membros leem" on public.duels for select to authenticated using ((select private.is_group_member(group_id)));
create policy "duelo: a própria participação" on public.duel_entries for select to authenticated using (user_id = (select auth.uid()));

create function public.create_group(p_name text, p_nickname text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid; v_code text; v_try int := 0;
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  if (select count(*) from public.study_groups g where g.created_by = auth.uid()) >= 10 then
    raise exception 'resolve_group_limit' using errcode = 'P0001', hint = 'Até 10 grupos criados por conta.';
  end if;
  loop
    v_code := (select string_agg(substr(v_alpha, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 8));
    exit when not exists (select 1 from public.study_groups g where g.invite_code = v_code);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'resolve_code_exhausted' using errcode = 'P0001'; end if;
  end loop;
  insert into public.study_groups (name, invite_code, created_by) values (btrim(p_name), v_code, auth.uid()) returning id into v_id;
  insert into public.study_group_members (group_id, user_id, nickname) values (v_id, auth.uid(), btrim(p_nickname));
  return v_id;
end;
$$;

create function public.join_group(p_code text, p_nickname text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_group uuid;
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  select g.id into v_group from public.study_groups g where g.invite_code = upper(btrim(p_code));
  if v_group is null then
    raise exception 'resolve_group_not_found' using errcode = 'P0001';
  end if;
  if (select count(*) from public.study_group_members m where m.group_id = v_group and m.left_at is null) >= 30
     and not private.is_group_member(v_group) then
    raise exception 'resolve_group_full' using errcode = 'P0001', hint = 'Até 30 pessoas por grupo.';
  end if;
  insert into public.study_group_members (group_id, user_id, nickname) values (v_group, auth.uid(), btrim(p_nickname))
  on conflict (group_id, user_id) do update set left_at = null, nickname = excluded.nickname;
  return v_group;
end;
$$;

create function public.leave_group(p_group uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.study_group_members set left_at = now()
   where group_id = p_group and user_id = auth.uid() and left_at is null;
end;
$$;

-- Duelo: sorteia questões publicadas (não anuladas) da área; fica aberto 7 dias.
create function public.create_duel(p_group uuid, p_area text, p_count int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_items uuid[]; v_id uuid;
begin
  if not private.is_group_member(p_group) then
    raise exception 'resolve_not_member' using errcode = 'P0001';
  end if;
  if p_count not between 3 and 20 or (p_area is not null and p_area not in ('LC', 'CH', 'CN', 'MT')) then
    raise exception 'resolve_duel_invalid' using errcode = 'P0001';
  end if;
  select array_agg(x.id) into v_items from (
    select iv.id from public.item_versions iv join public.areas ar on ar.id = iv.area_id
     where iv.review_status = 'published' and not iv.annulled and (p_area is null or ar.code = p_area)
     order by random() limit p_count) x;
  if coalesce(cardinality(v_items), 0) < p_count then
    raise exception 'resolve_no_items' using errcode = 'P0001', hint = 'Não há questões publicadas suficientes nessa área.';
  end if;
  insert into public.duels (group_id, created_by, area, item_version_ids, closes_at)
  values (p_group, auth.uid(), p_area, v_items, now() + interval '7 days') returning id into v_id;
  return v_id;
end;
$$;

-- Entrar no duelo abre (uma vez) a sessão com a lista congelada; depois devolve a mesma sessão.
create function public.start_duel(p_duel uuid, p_client_action_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_duel public.duels%rowtype; v_session uuid;
begin
  select * into v_duel from public.duels d where d.id = p_duel;
  if not found or not private.is_group_member(v_duel.group_id) then
    raise exception 'resolve_duel_not_found' using errcode = 'P0001';
  end if;
  select e.session_id into v_session from public.duel_entries e where e.duel_id = p_duel and e.user_id = auth.uid();
  if v_session is not null then
    return v_session;
  end if;
  if v_duel.closes_at <= now() then
    raise exception 'resolve_duel_closed' using errcode = 'P0001';
  end if;
  v_session := public.start_session(p_client_action_id, 'treino', v_duel.item_version_ids, null, null, 'escolha');
  insert into public.duel_entries (duel_id, user_id, session_id) values (p_duel, auth.uid(), v_session)
  on conflict (duel_id, user_id) do nothing;
  return (select e.session_id from public.duel_entries e where e.duel_id = p_duel and e.user_id = auth.uid());
end;
$$;

-- Placar: apelido, respondidas e acertos. Os acertos dos outros só depois que você termina ou o duelo fecha.
create function public.duel_board(p_duel uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_duel public.duels%rowtype; v_total int; v_me_done boolean; v_open boolean;
begin
  select * into v_duel from public.duels d where d.id = p_duel;
  if not found or not private.is_group_member(v_duel.group_id) then
    raise exception 'resolve_duel_not_found' using errcode = 'P0001';
  end if;
  v_total := cardinality(v_duel.item_version_ids);
  v_open := v_duel.closes_at > now();
  select coalesce((select count(*) from public.duel_entries e join public.session_items si on si.session_id = e.session_id
                     join public.attempts a on a.session_item_id = si.id
                    where e.duel_id = p_duel and e.user_id = auth.uid()) >= v_total, false) into v_me_done;
  return jsonb_build_object(
    'id', v_duel.id, 'group_id', v_duel.group_id, 'area', v_duel.area, 'total', v_total,
    'closes_at', v_duel.closes_at, 'open', v_open, 'revealed', v_me_done or not v_open,
    'my_session', (select e.session_id from public.duel_entries e where e.duel_id = p_duel and e.user_id = auth.uid()),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
               'nickname', m.nickname, 'me', e.user_id = auth.uid(), 'answered', s.answered,
               'correct', case when e.user_id = auth.uid() or v_me_done or not v_open then s.correct end,
               'finished', s.answered >= v_total)
             order by (e.user_id = auth.uid()) desc, s.answered desc, e.created_at)
        from public.duel_entries e
        join public.study_group_members m on m.group_id = v_duel.group_id and m.user_id = e.user_id
        cross join lateral (
          select count(a.id)::int as answered, count(a.id) filter (where a.is_correct)::int as correct
            from public.session_items si left join public.attempts a on a.session_item_id = si.id
           where si.session_id = e.session_id) s
       where e.duel_id = p_duel), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.create_group(text, text), public.join_group(text, text), public.leave_group(uuid),
  public.create_duel(uuid, text, int), public.start_duel(uuid, uuid), public.duel_board(uuid) from public, anon;
grant execute on function public.create_group(text, text), public.join_group(text, text), public.leave_group(uuid),
  public.create_duel(uuid, text, int), public.start_duel(uuid, uuid), public.duel_board(uuid) to authenticated;
