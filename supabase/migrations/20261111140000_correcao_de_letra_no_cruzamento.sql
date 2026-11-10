-- Correção de letra sem par no cruzamento entre cores. Alguns cruzamentos foram gravados como "confere"
-- com uma letra vazia (o texto da alternativa saiu diferente na extração de uma das cores). O editor, depois
-- de conferir as duas cores no PDF oficial, preenche só a letra vazia; uma correspondência existente nunca
-- muda. Cada preenchimento fica registrado com o mapa anterior, o novo, quem conferiu e a justificativa.

create table public.variant_check_corrections (
  id uuid primary key default gen_random_uuid(),
  variant_check_id uuid not null references public.variant_checks (id),
  letter text not null check (letter in ('A', 'B', 'C', 'D', 'E')),
  other_letter text not null check (other_letter in ('A', 'B', 'C', 'D', 'E')),
  previous_map jsonb not null,
  new_map jsonb not null,
  note text not null check (char_length(note) between 10 and 1000),
  corrected_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);
create index variant_check_corrections_check on public.variant_check_corrections (variant_check_id);
alter table public.variant_check_corrections enable row level security;
grant select on public.variant_check_corrections to authenticated;
create policy "correções de cruzamento: editor lê" on public.variant_check_corrections for select to authenticated
  using ((select public.is_editor()));

create function public.fill_variant_letter(p_check uuid, p_letter text, p_other_letter text, p_note text)
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
  update public.variant_checks set letter_map = v_new where id = v.id;
  return v_new;
end;
$$;
revoke all on function public.fill_variant_letter(uuid, text, text, text) from public, anon;
grant execute on function public.fill_variant_letter(uuid, text, text, text) to authenticated;
