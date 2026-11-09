-- F5-T02 — A política de remoção de redação consultava essay_versions, cuja política consulta essays:
-- recursão infinita. Remover a redação só pela própria conta; versão submetida continua protegida pelo
-- gatilho de essay_versions (a cascata da remoção é recusada se houver versão submetida).
drop policy "redações: remover a própria" on public.essays;
create policy "redações: remover a própria" on public.essays for delete to authenticated using (user_id = (select auth.uid()));
