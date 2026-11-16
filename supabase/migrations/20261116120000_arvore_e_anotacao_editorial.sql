-- Sessão 2 do plano v2: árvore de conteúdos e anotação editorial das questões já publicadas.
--
-- 1) subjects vira a árvore do curso: disciplina (só onde a matriz divide) → tema → objeto de conhecimento
--    (anexo da matriz v1, com página) → assunto (subdivisão do Resolve onde o objeto oficial junta vários
--    conteúdos; sem fonte própria, sempre filho do objeto oficial).
-- 2) item_annotation_proposals: proposta de anotação de uma versão publicada (habilidade, assunto, dependência,
--    evidências, distratores, resolução). Só o editor lê. Nada chega ao aluno antes da aprovação.
-- 3) approve_item_annotation: aplica a proposta aprovada de uma vez. Versões publicadas continuam imutáveis no
--    conteúdo; a única exceção é esta aprovação, uma vez por versão (anotação pendente → aprovada), marcada na
--    transação por resolve.annotating.

alter table public.subjects
  add column kind text check (kind in ('disciplina', 'tema', 'objeto', 'assunto')),
  add column position integer check (position >= 0),
  add column source_page integer check (source_page > 0),
  add column note text check (char_length(note) <= 300);

revoke all on public.subjects, public.skill_subject_links from anon;
grant insert, update on public.subjects to authenticated;
grant insert on public.skill_subject_links to authenticated;
create policy "assuntos: editor grava" on public.subjects for insert to authenticated with check ((select public.is_editor()));
create policy "assuntos: editor altera" on public.subjects for update to authenticated using ((select public.is_editor()));
create policy "vínculos de assunto: editor grava" on public.skill_subject_links for insert to authenticated with check ((select public.is_editor()));

create table public.item_annotation_proposals (
  id uuid primary key default gen_random_uuid(),
  item_version_id uuid not null references public.item_versions (id),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'schema' = 'anotacao/v1'
                                and private.json_strings_are_safe(payload)),
  origin text not null check (char_length(origin) between 3 and 200),
  status text not null default 'proposta' check (status in ('proposta', 'aprovada', 'devolvida', 'substituida')),
  review_note text check (char_length(review_note) <= 2000 and private.text_is_safe(review_note)),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz
);
create unique index item_annotation_one_open on public.item_annotation_proposals (item_version_id) where status = 'proposta';
create index item_annotation_status on public.item_annotation_proposals (status, created_at);

alter table public.item_annotation_proposals enable row level security;
revoke all on public.item_annotation_proposals from anon;
grant select, insert, update on public.item_annotation_proposals to authenticated;
create policy "anotação: editor lê" on public.item_annotation_proposals for select to authenticated using ((select public.is_editor()));
create policy "anotação: editor propõe" on public.item_annotation_proposals for insert to authenticated
  with check ((select public.is_editor()) and status = 'proposta');
create policy "anotação: editor altera" on public.item_annotation_proposals for update to authenticated using ((select public.is_editor()));

-- Exceção única à imutabilidade: a aprovação da anotação de uma versão publicada com anotação pendente.
create or replace function private.guard_item_version() returns trigger
language plpgsql set search_path = '' as $$
declare
  n int; ncorrect int;
begin
  if tg_op not in ('INSERT', 'UPDATE') then
    if old.review_status = 'published' then
      raise exception 'resolve_item_published_immutable' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.review_status = 'published' then
    if new.review_status = 'retired' and (to_jsonb(new) - 'review_status') = (to_jsonb(old) - 'review_status') then
      return new;
    end if;
    if new.review_status = 'published'
       and old.annotation_status = 'pendentes' and new.annotation_status = 'aprovadas'
       and coalesce(current_setting('resolve.annotating', true), '') = old.id::text
       and (to_jsonb(new) - array['annotation_status', 'explanation_steps', 'content_dependency'])
         = (to_jsonb(old) - array['annotation_status', 'explanation_steps', 'content_dependency']) then
      return new;
    end if;
    raise exception 'resolve_item_published_immutable' using errcode = 'P0001',
      hint = 'Correção cria nova versão do item.';
  end if;
  if new.review_status = 'published' then
    select count(*), count(*) filter (where is_correct) into n, ncorrect from public.alternatives where item_version_id = new.id;
    if n <> 5 or (not new.annulled and ncorrect <> 1) then
      raise exception 'resolve_item_publish_invalid' using errcode = 'P0001',
        hint = format('Publicação exige 5 alternativas e 1 correta (encontradas %s e %s).', n, ncorrect);
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create or replace function private.block_published_item_children() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_status text;
  v_id uuid := coalesce(new.item_version_id, old.item_version_id);
begin
  select review_status into v_status from public.item_versions where id = v_id;
  if v_status = 'published' then
    if tg_op = 'INSERT' and coalesce(current_setting('resolve.annotating', true), '') = v_id::text then
      return new;
    end if;
    raise exception 'resolve_item_published_immutable' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

-- Aprova a proposta (com o conteúdo final que o editor conferiu, que pode ter ajustes) e grava a anotação.
create function public.approve_item_annotation(p_proposal uuid, p_payload jsonb default null, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_prop public.item_annotation_proposals%rowtype;
  v_iv public.item_versions%rowtype;
  v_area uuid; v_area_code text;
  p jsonb; v_skill uuid; v_skill2 uuid; v_subject uuid;
  e jsonb; d jsonb; s jsonb;
  v_alt uuid; v_correct boolean; v_type uuid; v_type2 uuid;
  v_steps jsonb := '[]'::jsonb; i int := 0;
  n_ev int := 0; n_dis int := 0;
begin
  if not (select public.is_editor()) then
    raise exception 'resolve_not_editor' using errcode = 'P0001';
  end if;
  select * into v_prop from public.item_annotation_proposals where id = p_proposal for update;
  if not found or v_prop.status <> 'proposta' then
    raise exception 'resolve_annotation_not_open' using errcode = 'P0001';
  end if;
  select * into v_iv from public.item_versions where id = v_prop.item_version_id for update;
  if v_iv.review_status <> 'published' or v_iv.annotation_status <> 'pendentes' then
    raise exception 'resolve_annotation_not_pending' using errcode = 'P0001',
      hint = 'Só versão publicada com anotação pendente; correção depois disso cria nova versão.';
  end if;
  p := coalesce(p_payload, v_prop.payload);
  if p->>'schema' is distinct from 'anotacao/v1' or not private.json_strings_are_safe(p) then
    raise exception 'resolve_annotation_invalid' using errcode = 'P0001', hint = 'Formato anotacao/v1.';
  end if;
  v_area := v_iv.area_id;
  select code into v_area_code from public.areas where id = v_area;

  select id into v_skill from public.skills where area_id = v_area and code = p->>'skill';
  if v_skill is null then
    raise exception 'resolve_annotation_invalid' using errcode = 'P0001', hint = 'Habilidade fora da área da questão.';
  end if;
  if coalesce(p->>'skill_secondary', '') <> '' then
    select id into v_skill2 from public.skills where area_id = v_area and code = p->>'skill_secondary';
    if v_skill2 is null or v_skill2 = v_skill then
      raise exception 'resolve_annotation_invalid' using errcode = 'P0001', hint = 'Habilidade secundária inválida.';
    end if;
  end if;
  select id into v_subject from public.subjects where id = (p->>'subject')::uuid and area_code = v_area_code and kind in ('objeto', 'assunto');
  if v_subject is null then
    raise exception 'resolve_annotation_invalid' using errcode = 'P0001', hint = 'Assunto fora da árvore da área.';
  end if;
  if (p->>'content_dependency') is null or (p->>'content_dependency')::int not between 0 and 3 then
    raise exception 'resolve_annotation_invalid' using errcode = 'P0001', hint = 'Dependência de conteúdo de 0 a 3.';
  end if;
  if jsonb_typeof(p->'steps') <> 'array' or jsonb_array_length(p->'steps') = 0 then
    raise exception 'resolve_annotation_invalid' using errcode = 'P0001', hint = 'Resolução com pelo menos um passo.';
  end if;

  perform set_config('resolve.annotating', v_iv.id::text, true);

  insert into public.item_skill_tags (item_version_id, skill_id, is_primary, proposed_by, model_info, review_status, reviewer_id)
  values (v_iv.id, v_skill, true, 'modelo', jsonb_build_object('origem', v_prop.origin, 'proposta', v_prop.id), 'aprovada', auth.uid());
  if v_skill2 is not null then
    insert into public.item_skill_tags (item_version_id, skill_id, is_primary, proposed_by, model_info, review_status, reviewer_id)
    values (v_iv.id, v_skill2, false, 'modelo', jsonb_build_object('origem', v_prop.origin, 'proposta', v_prop.id), 'aprovada', auth.uid());
  end if;
  insert into public.item_subject_tags (item_version_id, subject_id, is_primary, proposed_by, model_info, review_status, reviewer_id)
  values (v_iv.id, v_subject, true, 'modelo', jsonb_build_object('origem', v_prop.origin, 'proposta', v_prop.id), 'aprovada', auth.uid());

  for s in select * from jsonb_array_elements(p->'steps') loop
    i := i + 1;
    if jsonb_typeof(s) <> 'string' or char_length(s #>> '{}') not between 3 and 1200 then
      raise exception 'resolve_annotation_invalid' using errcode = 'P0001', hint = 'Passo de resolução vazio ou longo demais.';
    end if;
    v_steps := v_steps || jsonb_build_array(jsonb_build_object('id', 'p' || i, 'text', s #>> '{}'));
  end loop;
  update public.item_versions
     set explanation_steps = v_steps, content_dependency = (p->>'content_dependency')::smallint, annotation_status = 'aprovadas'
   where id = v_iv.id;

  for e in select * from jsonb_array_elements(coalesce(p->'evidence', '[]'::jsonb)) loop
    insert into public.evidence_annotations (item_version_id, target_type, block_id, start_utf16, end_utf16, rationale)
    values (v_iv.id, 'text', e->>'block_id', (e->>'start_utf16')::int, (e->>'end_utf16')::int, nullif(e->>'rationale', ''));
    n_ev := n_ev + 1;
  end loop;

  for d in select * from jsonb_array_elements(coalesce(p->'distractors', '[]'::jsonb)) loop
    select id, is_correct into v_alt, v_correct from public.alternatives where item_version_id = v_iv.id and stable_key = d->>'key';
    if v_alt is null or v_correct then
      raise exception 'resolve_annotation_invalid' using errcode = 'P0001', hint = 'Distrator precisa ser uma alternativa incorreta.';
    end if;
    select id into v_type from public.distractor_types where code = d->>'type';
    if v_type is null then
      raise exception 'resolve_annotation_invalid' using errcode = 'P0001', hint = 'Tipo de distrator fora da taxonomia.';
    end if;
    insert into public.alternative_annotations (alternative_id, type_id, is_primary, rationale, review_status)
    values (v_alt, v_type, true, coalesce(d->>'rationale', ''), 'aprovada');
    if coalesce(d->>'secondary', '') not in ('', 'nenhum') then
      select id into v_type2 from public.distractor_types where code = d->>'secondary';
      if v_type2 is not null and v_type2 <> v_type then
        insert into public.alternative_annotations (alternative_id, type_id, is_primary, rationale, review_status)
        values (v_alt, v_type2, false, '', 'aprovada');
      end if;
    end if;
    n_dis := n_dis + 1;
  end loop;

  update public.item_annotation_proposals
     set status = 'aprovada', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note,
         payload = p
   where id = v_prop.id;
  insert into public.editorial_reviews (entity_type, entity_version_id, reviewer_id, checklist, decision, notes)
  values ('tags', v_iv.id, auth.uid(), jsonb_build_object('proposta', v_prop.id, 'ajustada', p_payload is not null), 'aprovar', p_note);

  return jsonb_build_object('item_version_id', v_iv.id, 'evidencias', n_ev, 'distratores', n_dis, 'passos', i);
end;
$$;
revoke all on function public.approve_item_annotation(uuid, jsonb, text) from public, anon;
grant execute on function public.approve_item_annotation(uuid, jsonb, text) to authenticated;

-- Devolve a proposta com o motivo (a questão continua com anotação pendente; nova proposta pode ser feita).
create function public.return_item_annotation(p_proposal uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select public.is_editor()) then
    raise exception 'resolve_not_editor' using errcode = 'P0001';
  end if;
  if char_length(trim(coalesce(p_note, ''))) < 10 then
    raise exception 'resolve_annotation_note_required' using errcode = 'P0001', hint = 'Diga o que precisa mudar (10 caracteres ou mais).';
  end if;
  update public.item_annotation_proposals
     set status = 'devolvida', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
   where id = p_proposal and status = 'proposta';
  if not found then
    raise exception 'resolve_annotation_not_open' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.return_item_annotation(uuid, text) from public, anon;
grant execute on function public.return_item_annotation(uuid, text) to authenticated;
