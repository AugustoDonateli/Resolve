-- Exclusão de redação e de conta (plano §3, regra 10: a exclusão de conta abrange redações e anexos).
-- Imutável continua significando "não muda": uma versão enviada não é alterada nem apagada sozinha,
-- e avaliações e anotações também não. Quando a própria redação é apagada (pela dona, ou em cascata ao
-- excluir a conta), tudo o que pertence a ela sai junto: versões, correções, avaliações, anotações e
-- resultados. Os registros de custo (F5-T08) ficam, sem o texto.

alter table public.essay_jobs drop constraint essay_jobs_version_id_fkey,
  add constraint essay_jobs_version_id_fkey foreign key (version_id) references public.essay_versions (id) on delete cascade;

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
  new.updated_at := now();
  return new;
end;
$$;

-- Reescrita aponta para a versão anterior: ao apagar a redação inteira, a ligação não pode travar a cascata.
alter table public.essay_versions drop constraint essay_versions_parent_id_fkey,
  add constraint essay_versions_parent_id_fkey foreign key (parent_id) references public.essay_versions (id) on delete cascade;

create or replace function private.guard_essay_evaluation() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_rubric uuid; v_allowed smallint[]; v_codes text[]; v_sum int;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.essay_jobs j where j.id = old.job_id) then
      raise exception 'resolve_evaluation_immutable' using errcode = 'P0001';
    end if;
    return old; -- correção apagada junto com a redação
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'resolve_evaluation_immutable' using errcode = 'P0001';
  end if;
  select j.rubric_id into v_rubric from public.essay_jobs j where j.id = new.job_id;
  select r.allowed_scores into v_allowed from public.essay_rubrics r where r.id = v_rubric;
  v_codes := array(select d.code from public.rubric_dimensions d where d.rubric_id = v_rubric order by d.code);
  if array(select k from jsonb_object_keys(new.scores) k order by k) is distinct from v_codes then
    raise exception 'resolve_evaluation_competencies' using errcode = 'P0001', hint = 'Notas exigem exatamente as competências da rubrica.';
  end if;
  if exists (select 1 from jsonb_each(new.scores) s
             where jsonb_typeof(s.value) <> 'number' or not ((s.value)::text::smallint = any (v_allowed)) or (s.value)::text ~ '\.') then
    raise exception 'resolve_evaluation_score_step' using errcode = 'P0001', hint = 'Cada nota precisa ser um dos degraus da rubrica.';
  end if;
  select sum((s.value)::text::int) into v_sum from jsonb_each(new.scores) s;
  if v_sum <> new.total then
    raise exception 'resolve_evaluation_total' using errcode = 'P0001', hint = 'Total diferente da soma das competências.';
  end if;
  return new;
end;
$$;

create or replace function private.guard_essay_annotation() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_text text;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.essay_evaluations ev where ev.id = old.evaluation_id) then
      raise exception 'resolve_annotation_immutable' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'resolve_annotation_immutable' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.rubric_dimensions d join public.essay_jobs j on j.rubric_id = d.rubric_id
                 join public.essay_evaluations ev on ev.job_id = j.id where ev.id = new.evaluation_id and d.code = new.competency) then
    raise exception 'resolve_annotation_competency' using errcode = 'P0001';
  end if;
  if not new.absent then
    select p->>'text' into v_text
    from public.essay_evaluations ev join public.essay_jobs j on j.id = ev.job_id
    join public.essay_versions v on v.id = j.version_id
    cross join lateral jsonb_array_elements(v.paragraphs_json) p
    where ev.id = new.evaluation_id and p->>'id' = new.paragraph_id limit 1;
    if v_text is null then
      raise exception 'resolve_annotation_paragraph_missing' using errcode = 'P0001';
    end if;
    if new.end_utf16 > private.utf16_length(v_text) then
      raise exception 'resolve_annotation_out_of_range' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_essay_version(), private.guard_essay_evaluation(), private.guard_essay_annotation() from public, anon, authenticated;
