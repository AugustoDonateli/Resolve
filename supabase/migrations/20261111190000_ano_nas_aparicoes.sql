-- Com duas edições publicadas, a origem da questão precisa do ano. A view passa a trazer o ano da
-- aplicação em cada aparecimento (mesmas colunas; muda só o conteúdo do JSON).
create or replace view public.study_items with (security_invoker = true) as
 select iv.id as item_version_id,
    ar.code as area,
    iv.foreign_language,
    iv.annulled,
    sv.blocks_json as stimulus_blocks,
    iv.command_blocks,
    (select jsonb_agg(jsonb_build_object('key', al.stable_key, 'content_blocks', al.content_blocks) order by al.stable_key)
       from public.alternatives al
      where al.item_version_id = iv.id) as alternatives,
    (select jsonb_agg(jsonb_build_object('year', ap.year, 'booklet', bk.booklet_number, 'day', bk.day, 'color', bk.color, 'position', bi."position")
                      order by ap.year desc, bk.day, bk.booklet_number)
       from public.booklet_items bi
       join public.booklets bk on bk.id = bi.booklet_id
       join public.applications ap on ap.id = bk.application_id
      where bi.item_version_id = iv.id) as appearances,
    iv.published_at,
    iv.item_id,
    iv.annotation_status,
    iv.stimulus_version_id
   from public.item_versions iv
     join public.areas ar on ar.id = iv.area_id
     left join public.stimulus_versions sv on sv.id = iv.stimulus_version_id
  where iv.review_status = 'published'::text;
