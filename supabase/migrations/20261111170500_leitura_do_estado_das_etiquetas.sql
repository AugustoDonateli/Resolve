-- A visão study_items (security invoker) passou a expor annotation_status em 20261111131000, mas a conta
-- de aluno só tinha leitura de colunas escolhidas de item_versions: qualquer leitura da visão falhava com
-- "permission denied". O estado das etiquetas ('pendentes'/'aprovadas') não é sigiloso (o retorno dos
-- treinos já o devolve); a política de linhas continua limitando a leitura às versões publicadas.
grant select (annotation_status) on public.item_versions to authenticated;
