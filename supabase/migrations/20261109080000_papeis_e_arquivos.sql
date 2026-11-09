-- F2-T05 — Isolamento e papéis.
-- Papel de editor numa tabela que nenhum cliente consegue escrever (só o dono do banco, por SQL).
-- O aluno lê só o que é dele e o conteúdo publicado; o editor lê e escreve a área editorial.
-- Arquivos: bucket "editorial" (só editores) e bucket "pessoal" (cada conta na própria pasta).

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('editor')),
  granted_by text not null check (char_length(granted_by) between 1 and 200),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;
create policy "papel: ler o próprio" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

-- Usada nas políticas. Invocador: lê só a própria linha de user_roles (política acima).
create function public.is_editor() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'editor');
$$;
revoke all on function public.is_editor() from public, anon;
grant execute on function public.is_editor() to authenticated;

-- ── Área editorial (preparação) ───────────────────────────────────────────────
grant select, insert on public.ingest_batches to authenticated;
grant select, insert, update on public.item_proposals to authenticated;
grant select, insert, update on public.doubt_queue to authenticated;

create policy "editor: lotes" on public.ingest_batches for select to authenticated using ((select public.is_editor()));
create policy "editor: criar lote" on public.ingest_batches for insert to authenticated with check ((select public.is_editor()));
create policy "editor: propostas" on public.item_proposals for select to authenticated using ((select public.is_editor()));
create policy "editor: criar proposta" on public.item_proposals for insert to authenticated with check ((select public.is_editor()));
create policy "editor: alterar proposta" on public.item_proposals for update to authenticated
  using ((select public.is_editor())) with check ((select public.is_editor()));
create policy "editor: dúvidas" on public.doubt_queue for select to authenticated using ((select public.is_editor()));
create policy "editor: abrir dúvida" on public.doubt_queue for insert to authenticated with check ((select public.is_editor()));
create policy "editor: resolver dúvida" on public.doubt_queue for update to authenticated
  using ((select public.is_editor())) with check ((select public.is_editor()) and (resolved_by is null or resolved_by = (select auth.uid())));

-- ── Conteúdo em preparação: editor lê rascunhos (escrita só pela publicação, F2-T14) ──
do $$
declare t text;
begin
  foreach t in array array['items', 'item_versions', 'stimulus_versions', 'alternatives', 'booklet_items',
                           'booklet_alternative_maps', 'item_skill_tags', 'item_subject_tags', 'evidence_annotations',
                           'alternative_annotations', 'editorial_reviews']
  loop
    execute format('create policy "editor: ler rascunhos" on public.%I for select to authenticated using ((select public.is_editor()))', t);
  end loop;
end $$;
-- Tabelas sem leitura para alunos até aqui precisam do privilégio de tabela (a política restringe ao editor).
grant select on public.evidence_annotations, public.alternative_annotations, public.editorial_reviews to authenticated;

-- ── Arquivos ──────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('editorial', 'editorial', false, 20971520, array['image/png', 'image/webp', 'application/pdf', 'application/json']),
  ('pessoal', 'pessoal', false, 10485760, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain'])
on conflict (id) do nothing;

create policy "editorial: editor lê" on storage.objects for select to authenticated
  using (bucket_id = 'editorial' and (select public.is_editor()));
create policy "editorial: editor envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'editorial' and (select public.is_editor()));
create policy "editorial: editor substitui" on storage.objects for update to authenticated
  using (bucket_id = 'editorial' and (select public.is_editor())) with check (bucket_id = 'editorial' and (select public.is_editor()));
create policy "editorial: editor remove" on storage.objects for delete to authenticated
  using (bucket_id = 'editorial' and (select public.is_editor()));

-- Pasta pessoal: primeiro segmento do caminho = id da conta.
create policy "pessoal: ler a própria pasta" on storage.objects for select to authenticated
  using (bucket_id = 'pessoal' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pessoal: enviar para a própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'pessoal' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pessoal: substituir na própria pasta" on storage.objects for update to authenticated
  using (bucket_id = 'pessoal' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'pessoal' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "pessoal: remover da própria pasta" on storage.objects for delete to authenticated
  using (bucket_id = 'pessoal' and (storage.foldername(name))[1] = (select auth.uid())::text);

create index user_roles_role on public.user_roles (role);
