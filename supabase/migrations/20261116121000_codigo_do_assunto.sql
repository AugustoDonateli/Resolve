-- Código curto e estável de cada nó da árvore (área.tema.objeto[.assunto]); disciplina usa área.D<n>.
alter table public.subjects add column code text unique check (code ~ '^(LC|MT|CN|CH)(\.D?[0-9]+){1,3}$');
