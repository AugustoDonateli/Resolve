-- F2-T05 — Uma política de leitura por tabela (publicado OU editor), em vez de duas permissivas.
-- Mesmo efeito, avaliado uma vez por linha (lint 0006).
do $$
declare
  r record;
begin
  for r in select * from (values
    ('item_versions', 'item publicado', $q$review_status = 'published'$q$),
    ('items', 'item de versão publicada', $q$exists (select 1 from public.item_versions iv where iv.item_id = items.id and iv.review_status = 'published')$q$),
    ('stimulus_versions', 'estímulo de item publicado', $q$exists (select 1 from public.item_versions iv where iv.stimulus_version_id = stimulus_versions.id and iv.review_status = 'published')$q$),
    ('alternatives', 'alternativa de item publicado', $q$exists (select 1 from public.item_versions iv where iv.id = alternatives.item_version_id and iv.review_status = 'published')$q$),
    ('booklet_items', 'posição de item publicado', $q$exists (select 1 from public.item_versions iv where iv.id = booklet_items.item_version_id and iv.review_status = 'published')$q$),
    ('booklet_alternative_maps', 'mapa de letras de item publicado', $q$exists (select 1 from public.item_versions iv where iv.id = booklet_alternative_maps.item_version_id and iv.review_status = 'published')$q$),
    ('item_skill_tags', 'habilidade aprovada de item publicado', $q$review_status = 'aprovada' and exists (select 1 from public.item_versions iv where iv.id = item_skill_tags.item_version_id and iv.review_status = 'published')$q$),
    ('item_subject_tags', 'assunto aprovado de item publicado', $q$review_status = 'aprovada' and exists (select 1 from public.item_versions iv where iv.id = item_subject_tags.item_version_id and iv.review_status = 'published')$q$)
  ) as t(tbl, old_name, expr)
  loop
    execute format('drop policy %I on public.%I', r.old_name, r.tbl);
    execute format('drop policy "editor: ler rascunhos" on public.%I', r.tbl);
    execute format('create policy "publicado ou editor" on public.%I for select to authenticated using ((select public.is_editor()) or (%s))', r.tbl, r.expr);
  end loop;
end $$;
