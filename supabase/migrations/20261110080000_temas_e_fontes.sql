-- F5-T03 — Temas e fontes. Critério do backlog: cada trecho possui fonte; tema não contém dado fabricado.
-- Plano §4.5: "Tema publicado após conferir textos motivadores; nenhum dado inventado."
--
-- O tema oficial vem do caderno do Inep. A extração e a conferência ficam em tools/ingest/temas.py.
-- Cada texto motivador guarda:
--   * blocos na ordem do caderno (parágrafo, título, figura com texto alternativo);
--   * a citação como está impressa;
--   * quem conferiu e quando.
-- Publicar exige a lista de impedimentos vazia. Mudar o conteúdo de um texto conferido devolve a conferência.

alter table public.essay_prompts
  add column origin text not null default 'editorial' check (origin in ('oficial', 'editorial')),
  add column source_id uuid references public.sources (id),
  add column source_locator text check (char_length(source_locator) between 1 and 200 and private.text_is_safe(source_locator)),
  add column edition text check (char_length(edition) between 1 and 120 and private.text_is_safe(edition)),
  add constraint essay_prompts_official_source check (origin <> 'oficial' or (source_id is not null and source_locator is not null));

alter table public.motivating_texts
  add column blocks jsonb not null default '[]'::jsonb check (private.blocks_are_safe(blocks) and jsonb_array_length(blocks) <= 30),
  add column citation text check (char_length(citation) between 1 and 600 and private.text_is_safe(citation)),
  add column verified_by uuid references auth.users (id),
  add column verified_at timestamptz,
  add constraint motivating_texts_verified check ((rights_status = 'verificado') = (verified_at is not null and verified_by is not null));

-- Texto motivador:
--   * trecho corrido derivado dos blocos;
--   * conferência registrada com a conta de quem conferiu;
--   * conteúdo alterado volta a "pendente";
--   * nada muda depois que o tema sai de rascunho.
create or replace function private.guard_motivating_text() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.essay_prompts p where p.id = coalesce(new.prompt_id, old.prompt_id) and p.status <> 'draft') then
    raise exception 'resolve_prompt_published_immutable' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if tg_op = 'UPDATE' and new.prompt_id <> old.prompt_id then
    raise exception 'resolve_motivating_text_moved' using errcode = 'P0001';
  end if;
  if jsonb_array_length(new.blocks) > 0 then
    new.excerpt := (select string_agg(b->>'text', E'\n\n' order by ord)
                    from jsonb_array_elements(new.blocks) with ordinality as t(b, ord)
                    where coalesce(b->>'text', '') <> '');
  end if;
  if tg_op = 'UPDATE' and old.rights_status = 'verificado'
     and (new.blocks, new.excerpt, new.citation, new.source_id, new.page_or_locator, new.position)
         is distinct from (old.blocks, old.excerpt, old.citation, old.source_id, old.page_or_locator, old.position) then
    new.rights_status := 'pendente'; -- conteúdo mudou: precisa ser conferido de novo
  end if;
  if new.rights_status = 'verificado' and (tg_op = 'INSERT' or old.rights_status <> 'verificado') then
    new.verified_by := auth.uid();
    new.verified_at := now();
  elsif new.rights_status <> 'verificado' then
    new.verified_by := null;
    new.verified_at := null;
  else
    new.verified_by := old.verified_by;
    new.verified_at := old.verified_at;
  end if;
  return new;
end;
$$;

-- O que impede a publicação de um tema (lista vazia = pode publicar). Usada pelo gatilho e pela tela.
create function private.essay_prompt_blockers(p_prompt uuid) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  p public.essay_prompts%rowtype;
  m record; b jsonb;
  out text[] := '{}';
begin
  select * into p from public.essay_prompts where id = p_prompt;
  if not found then
    return array['tema não encontrado'];
  end if;
  if p.origin = 'oficial' and (p.source_id is null or p.source_locator is null) then
    out := array_append(out, 'tema oficial sem fonte e localização no caderno');
  end if;
  if not exists (select 1 from public.motivating_texts t where t.prompt_id = p_prompt) then
    out := array_append(out, 'nenhum texto motivador');
  end if;
  for m in select * from public.motivating_texts t where t.prompt_id = p_prompt order by t.position loop
    if m.citation is null then
      out := array_append(out, format('texto %s sem citação da fonte', m.position));
    end if;
    if m.rights_status <> 'verificado' then
      out := array_append(out, format('texto %s ainda não conferido', m.position));
    end if;
    for b in select * from jsonb_array_elements(m.blocks) loop
      if b->>'type' = 'image' then
        if coalesce(trim(b->>'text'), '') = '' then
          out := array_append(out, format('texto %s: figura sem texto alternativo', m.position));
        end if;
        if b->>'asset_ref' is null or not exists (
             select 1 from storage.objects o where o.bucket_id = 'editorial' and o.name = b->>'asset_ref') then
          out := array_append(out, format('texto %s: figura sem arquivo no armazenamento', m.position));
        end if;
      end if;
    end loop;
  end loop;
  return out;
end;
$$;

create function public.essay_prompt_blockers(p_prompt uuid) returns text[]
language sql stable security invoker set search_path = '' as $$
  select case when (select public.is_editor()) then private.essay_prompt_blockers(p_prompt) end;
$$;

-- Publicação: impedimentos precisam estar vazios; publicado só aposenta.
create or replace function private.guard_essay_prompt() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_blockers text[];
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'resolve_prompt_published_immutable' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if old.status = 'published' and new.status = 'retired'
       and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
      return new;
    end if;
    raise exception 'resolve_prompt_published_immutable' using errcode = 'P0001';
  end if;
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      raise exception 'resolve_prompt_publish_invalid' using errcode = 'P0001', hint = 'Crie como rascunho, inclua os textos motivadores e publique.';
    end if;
    -- a lista lê a linha gravada; a origem e a fonte valem pelos valores novos
    v_blockers := array_remove(private.essay_prompt_blockers(new.id), 'tema oficial sem fonte e localização no caderno');
    if new.origin = 'oficial' and (new.source_id is null or new.source_locator is null) then
      v_blockers := array_append(v_blockers, 'tema oficial sem fonte e localização no caderno');
    end if;
    if cardinality(v_blockers) > 0 then
      raise exception 'resolve_prompt_sources_unverified' using errcode = 'P0001', detail = array_to_string(v_blockers, '; '),
        hint = 'Tema só é publicado com texto motivador de fonte e direitos conferidos.';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

-- Figura de tema publicado: qualquer conta lê o recorte (só ele; o resto do bucket segue do editor).
create policy "figura de tema publicado: contas leem" on storage.objects for select to authenticated
  using (bucket_id = 'editorial' and exists (
    select 1 from public.motivating_texts m join public.essay_prompts p on p.id = m.prompt_id
    where p.status = 'published' and m.blocks @> jsonb_build_array(jsonb_build_object('asset_ref', objects.name))));

create index essay_prompts_source on public.essay_prompts (source_id);
create index motivating_texts_verified_by on public.motivating_texts (verified_by);
create index motivating_texts_blocks on public.motivating_texts using gin (blocks jsonb_path_ops);

revoke all on function private.essay_prompt_blockers(uuid) from public, anon;
grant execute on function private.essay_prompt_blockers(uuid) to authenticated;
revoke all on function public.essay_prompt_blockers(uuid) from public, anon;
grant execute on function public.essay_prompt_blockers(uuid) to authenticated;
revoke all on function private.guard_motivating_text() from public, anon, authenticated;
revoke all on function private.guard_essay_prompt() from public, anon, authenticated;
