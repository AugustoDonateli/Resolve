-- F4-T17 — correção: nomes de saída de focus_action iguais aos das colunas (#variable_conflict use_column).
-- Idempotente: a migração 180000 já traz a versão corrigida.
create or replace function public.focus_action(p_block_id uuid, p_action text)
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