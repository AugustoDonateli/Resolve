-- A marcação é gravada com upsert (a mesma parte marcada de novo substitui a anterior); o upsert reescreve as colunas da chave.
grant update (lesson_slug, section) on public.lesson_feedback to authenticated;
