-- Trava própria do cruzamento: continua só de acréscimo, exceto o preenchimento de letra vazia feito por
-- public.fill_variant_letter (sinalizado na transação). Letras existentes e demais campos não podem mudar.
create function private.guard_variant_checks() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and current_setting('resolve.variant_letter_fill', true) = 'on'
     and (to_jsonb(new) - 'letter_map') = (to_jsonb(old) - 'letter_map')
     and not exists (select 1 from jsonb_each_text(old.letter_map) o
                     where coalesce(o.value, '') <> '' and new.letter_map->>o.key is distinct from o.value) then
    return new;
  end if;
  raise exception 'resolve_append_only' using errcode = 'P0001', hint = 'Crie uma nova versão.';
end;
$$;
create or replace trigger variant_checks_append_only before update or delete on public.variant_checks
  for each row execute function private.guard_variant_checks();

create or replace function public.fill_variant_letter(p_check uuid, p_letter text, p_other_letter text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v public.variant_checks%rowtype; v_new jsonb;
begin
  if auth.uid() is null or not public.is_editor() then
    raise exception 'resolve_not_editor' using errcode = 'P0001';
  end if;
  if p_letter not in ('A', 'B', 'C', 'D', 'E') or p_other_letter not in ('A', 'B', 'C', 'D', 'E') then
    raise exception 'resolve_letter_invalid' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 10 or not private.text_is_safe(p_note) then
    raise exception 'resolve_note_required' using errcode = 'P0001', hint = 'Diga como as duas cores foram conferidas.';
  end if;
  select * into v from public.variant_checks where id = p_check for update;
  if not found then
    raise exception 'resolve_variant_check_not_found' using errcode = 'P0001';
  end if;
  if v.result <> 'confere' or coalesce(v.letter_map->>p_letter, '') <> '' then
    raise exception 'resolve_letter_not_empty' using errcode = 'P0001', hint = 'Só se preenche letra vazia de cruzamento conferido.';
  end if;
  if exists (select 1 from jsonb_each_text(v.letter_map) m where m.value = p_other_letter) then
    raise exception 'resolve_letter_already_used' using errcode = 'P0001', hint = 'A letra da outra cor já corresponde a outra alternativa.';
  end if;
  v_new := v.letter_map || jsonb_build_object(p_letter, p_other_letter);
  insert into public.variant_check_corrections (variant_check_id, letter, other_letter, previous_map, new_map, note, corrected_by)
  values (v.id, p_letter, p_other_letter, v.letter_map, v_new, p_note, auth.uid());
  perform set_config('resolve.variant_letter_fill', 'on', true);
  update public.variant_checks set letter_map = v_new where id = v.id;
  perform set_config('resolve.variant_letter_fill', 'off', true);
  return v_new;
end;
$$;
