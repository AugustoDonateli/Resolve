-- Correção de questão publicada. Versão publicada é imutável: a correção cria a versão seguinte do mesmo
-- item, com o texto corrigido, leva junto a posição nos cadernos e o mapa de letras impressas, publica a
-- nova e aposenta a anterior. Respostas antigas continuam ligadas à versão em que foram dadas.
-- Só para conteúdo com etiquetas pendentes (sem anotações ligadas às alternativas antigas).

create table public.item_corrections (
  id uuid primary key default gen_random_uuid(),
  old_version_id uuid not null references public.item_versions (id),
  new_version_id uuid not null unique references public.item_versions (id),
  note text not null check (char_length(note) between 10 and 2000 and private.text_is_safe(note)),
  changed text[] not null,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);
alter table public.item_corrections enable row level security;
revoke all on public.item_corrections from anon;
revoke truncate, trigger, references, insert, update on public.item_corrections from authenticated;
grant select on public.item_corrections to authenticated;
create policy "correções: editor lê" on public.item_corrections for select to authenticated using ((select public.is_editor()));

create function public.correct_published_item(p_item_version uuid, p_alternatives jsonb, p_command_blocks jsonb,
                                               p_stimulus_blocks jsonb, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.item_versions%rowtype; v_new uuid; v_sv uuid; v_changed text[] := '{}';
  v_fp text; a record; v_alt uuid;
begin
  if not public.is_editor() then
    raise exception 'resolve_not_editor' using errcode = 'P0001';
  end if;
  select * into v_old from public.item_versions where id = p_item_version for update;
  if not found or v_old.review_status <> 'published' then
    raise exception 'resolve_item_not_published' using errcode = 'P0001';
  end if;
  if v_old.annotation_status <> 'pendentes'
     or exists (select 1 from public.alternative_annotations aa join public.alternatives al on al.id = aa.alternative_id where al.item_version_id = v_old.id) then
    raise exception 'resolve_correction_has_annotations' using errcode = 'P0001', hint = 'Só conteúdo com etiquetas pendentes.';
  end if;
  if (p_command_blocks is not null and not private.blocks_are_safe(p_command_blocks))
     or (p_stimulus_blocks is not null and not private.blocks_are_safe(p_stimulus_blocks)) then
    raise exception 'resolve_blocks_invalid' using errcode = 'P0001';
  end if;

  v_sv := v_old.stimulus_version_id;
  if p_stimulus_blocks is not null then
    v_fp := encode(extensions.digest(convert_to(p_stimulus_blocks::text, 'UTF8'), 'sha256'), 'hex');
    select sv.id into v_sv from public.stimulus_versions sv where sv.fingerprint = v_fp;
    if v_sv is null then
      insert into public.stimulus_versions (source_id, blocks_json, fingerprint)
      select sv.source_id, p_stimulus_blocks, v_fp from public.stimulus_versions sv where sv.id = v_old.stimulus_version_id
      returning id into v_sv;
    end if;
    v_changed := v_changed || 'stimulus_blocks';
  end if;
  if p_command_blocks is not null then v_changed := v_changed || 'command_blocks'; end if;

  insert into public.item_versions (item_id, version, stimulus_version_id, command_blocks, area_id, foreign_language,
                                    content_dependency, explanation_steps, review_status, annotation_status, annulled)
  values (v_old.item_id, v_old.version + 1, v_sv, coalesce(p_command_blocks, v_old.command_blocks), v_old.area_id, v_old.foreign_language,
          v_old.content_dependency, v_old.explanation_steps, 'draft', v_old.annotation_status, v_old.annulled)
  returning id into v_new;

  for a in select * from public.alternatives where item_version_id = v_old.id loop
    if p_alternatives ? a.stable_key then
      if not private.blocks_are_safe(p_alternatives->a.stable_key) or jsonb_array_length(p_alternatives->a.stable_key) = 0 then
        raise exception 'resolve_blocks_invalid' using errcode = 'P0001';
      end if;
      v_changed := v_changed || ('alternativa ' || a.stable_key);
    end if;
    insert into public.alternatives (item_version_id, stable_key, content_blocks, is_correct)
    values (v_new, a.stable_key, coalesce(p_alternatives->a.stable_key, a.content_blocks), a.is_correct);
  end loop;

  -- posição nos cadernos e letras impressas passam para a versão nova (um único comando, para as
  -- chaves estrangeiras serem conferidas no fim)
  with moved as (
    update public.booklet_items bi set item_version_id = v_new where bi.item_version_id = v_old.id returning bi.id
  )
  update public.booklet_alternative_maps m
     set item_version_id = v_new,
         alternative_id = (select n.id from public.alternatives n join public.alternatives o on o.stable_key = n.stable_key
                            where n.item_version_id = v_new and o.id = m.alternative_id)
   where m.booklet_item_id in (select id from moved);

  update public.item_versions set review_status = 'published' where id = v_new;
  update public.item_versions set review_status = 'retired' where id = v_old.id;
  insert into public.item_corrections (old_version_id, new_version_id, note, changed) values (v_old.id, v_new, p_note, v_changed);
  return v_new;
end;
$$;
revoke all on function public.correct_published_item(uuid, jsonb, jsonb, jsonb, text) from public, anon;
grant execute on function public.correct_published_item(uuid, jsonb, jsonb, jsonb, text) to authenticated;
