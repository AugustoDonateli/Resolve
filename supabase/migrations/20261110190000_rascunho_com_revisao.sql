-- F5-T05 — Editor com autosave. Critério: recarregar e reconectar recupera rascunho; conflito não sobrescreve
-- silenciosamente. O rascunho ganha um contador de revisão mantido pelo banco; o app grava com
-- "revisão esperada" e, se outra aba ou aparelho gravou antes, recebe 0 linhas e mostra as duas versões.
alter table public.essay_versions add column revision integer not null default 0 check (revision >= 0);

create or replace function private.guard_essay_version() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_owner uuid;
begin
  if tg_op = 'DELETE' then
    -- versão enviada só sai junto com a redação (a redação já não existe quando a cascata chega aqui)
    if old.status = 'submetida' and exists (select 1 from public.essays e where e.id = old.essay_id) then
      raise exception 'resolve_essay_submitted_immutable' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status = 'submetida' then
    raise exception 'resolve_essay_submitted_immutable' using errcode = 'P0001', hint = 'Reescrita cria uma nova versão.';
  end if;
  if tg_op = 'UPDATE' and new.essay_id <> old.essay_id then
    raise exception 'resolve_essay_version_moved' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(new.paragraphs_json) p
             where jsonb_typeof(p) <> 'object' or (p->>'id') !~ '^[a-z0-9_-]{1,24}$'
                or jsonb_typeof(p->'text') <> 'string'
                or exists (select 1 from jsonb_object_keys(p) k where k not in ('id', 'text')))
     or (select count(distinct p->>'id') from jsonb_array_elements(new.paragraphs_json) p) <> jsonb_array_length(new.paragraphs_json) then
    raise exception 'resolve_essay_paragraphs_invalid' using errcode = 'P0001';
  end if;
  new.plain_text := coalesce((select string_agg(p->>'text', E'\n\n' order by ord)
                              from jsonb_array_elements(new.paragraphs_json) with ordinality as t(p, ord)), '');
  select e.user_id into v_owner from public.essays e where e.id = new.essay_id;
  if new.attachment_path is not null and split_part(new.attachment_path, '/', 1) <> v_owner::text then
    raise exception 'resolve_essay_attachment_foreign' using errcode = 'P0001', hint = 'Anexo só na pasta da própria conta.';
  end if;
  if new.parent_id is not null and not exists (select 1 from public.essay_versions pv where pv.id = new.parent_id and pv.essay_id = new.essay_id) then
    raise exception 'resolve_essay_parent_invalid' using errcode = 'P0001';
  end if;
  if new.status = 'submetida' then
    if char_length(trim(new.plain_text)) = 0 then
      raise exception 'resolve_essay_empty' using errcode = 'P0001';
    end if;
    new.submitted_at := now();
    new.sha256 := encode(extensions.digest(convert_to(new.plain_text, 'UTF8'), 'sha256'), 'hex');
  else
    new.submitted_at := null;
    new.sha256 := null;
  end if;
  -- Contador de revisão do rascunho (F5-T05): cada gravação incrementa; o cliente grava só se a revisão
  -- que ele viu ainda é a atual, senão recebe conflito e escolhe entre as versões.
  new.revision := case when tg_op = 'UPDATE' then old.revision + 1 else 0 end;
  new.updated_at := now();
  return new;
end;
$$;
