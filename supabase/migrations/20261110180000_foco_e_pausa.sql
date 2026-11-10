-- F4-T17 — Foco e pausa. Critério: recuperação de temporizador correta; a interface não promete bloquear
-- outros apps. Plano §4.4: focus_intervals (block_id, start, end, pause_kind). O tempo vem só de horários do
-- servidor: tempo ativo = soma dos intervalos fechados + (agora − início do aberto). Recarregar, fechar a aba
-- ou trocar de aparelho não muda a conta.
create table public.focus_intervals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  block_id uuid not null references public.study_blocks (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_kind text check (end_kind in ('pausa', 'concluido', 'interrompido')),
  check ((ended_at is null) = (end_kind is null)),
  check (ended_at is null or ended_at >= started_at)
);
create unique index focus_intervals_one_open on public.focus_intervals (block_id) where ended_at is null;
create index focus_intervals_block on public.focus_intervals (block_id, started_at);
create index focus_intervals_user on public.focus_intervals (user_id);

-- Uma ação por vez, com o relógio do servidor. Devolve o estado recalculado.
create function public.focus_action(p_block_id uuid, p_action text)
returns table (status text, active_seconds integer, running boolean, planned_minutes smallint)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  b public.study_blocks%rowtype; v_open uuid;
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  select * into b from public.study_blocks where id = p_block_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'resolve_block_not_found' using errcode = 'P0001';
  end if;
  select id into v_open from public.focus_intervals where block_id = b.id and ended_at is null;
  if p_action = 'comecar' then
    if b.status not in ('planejado', 'em_curso') then
      raise exception 'resolve_block_closed' using errcode = 'P0001';
    end if;
    if v_open is null then
      insert into public.focus_intervals (user_id, block_id) values (auth.uid(), b.id);
    end if;
    update public.study_blocks set status = 'em_curso' where id = b.id and status <> 'em_curso';
  elsif p_action = 'pausar' then
    update public.focus_intervals set ended_at = now(), end_kind = 'pausa' where id = v_open;
  elsif p_action = 'concluir' then
    if b.status not in ('planejado', 'em_curso') then
      raise exception 'resolve_block_closed' using errcode = 'P0001';
    end if;
    update public.focus_intervals set ended_at = now(), end_kind = 'concluido' where id = v_open;
    update public.study_blocks set status = 'concluido',
      actual_minutes = least(600, round((select coalesce(sum(extract(epoch from (fi.ended_at - fi.started_at))), 0)
                                          from public.focus_intervals fi where fi.block_id = b.id) / 60.0))::smallint
     where id = b.id;
  elsif p_action <> 'estado' then
    raise exception 'resolve_focus_action_invalid' using errcode = 'P0001';
  end if;
  return query
    select sb.status,
           (select coalesce(sum(extract(epoch from (coalesce(fi.ended_at, now()) - fi.started_at))), 0)::integer
              from public.focus_intervals fi where fi.block_id = sb.id),
           exists (select 1 from public.focus_intervals fi where fi.block_id = sb.id and fi.ended_at is null),
           sb.planned_minutes
    from public.study_blocks sb where sb.id = b.id;
end;
$$;

alter table public.focus_intervals enable row level security;
revoke all on public.focus_intervals from anon, authenticated;
grant select on public.focus_intervals to authenticated;
create policy "intervalos de foco: os próprios" on public.focus_intervals for select to authenticated using (user_id = (select auth.uid()));
revoke all on function public.focus_action(uuid, text) from public, anon;
grant execute on function public.focus_action(uuid, text) to authenticated;
