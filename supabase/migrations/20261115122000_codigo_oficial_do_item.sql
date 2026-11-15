-- Código do item no banco do Inep (CO_ITEM dos microdados), gravado pela carga da TRI com a sessão de um editor.
-- Só preenche código vazio; código já usado por outro item faz a gravação falhar (unique em items).
create function public.set_official_item_codes(p_codes jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not (select public.is_editor()) then
    raise exception 'resolve_not_editor' using errcode = 'P0001';
  end if;
  update public.items i set official_item_code = x.code
  from jsonb_each_text(p_codes) as x(item_id, code)
  where i.id = x.item_id::uuid and i.official_item_code is null and x.code ~ '^[0-9]{1,12}$';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.set_official_item_codes(jsonb) from public, anon;
grant execute on function public.set_official_item_codes(jsonb) to authenticated;
