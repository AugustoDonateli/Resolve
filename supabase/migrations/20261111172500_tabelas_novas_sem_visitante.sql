-- As tabelas criadas desde 11/11 herdaram os privilégios padrão do Supabase (inclusive para o papel
-- anônimo). As políticas de linha já não devolviam nada a visitantes, mas, como no resto do banco,
-- visitante não tem privilégio algum nelas, e a conta logada não tem TRUNCATE/TRIGGER/REFERENCES.
do $$
declare t text;
begin
  foreach t in array array['study_groups', 'study_group_members', 'duels', 'duel_entries', 'repertoire_items',
                           'essay_track_progress', 'attempt_evidence', 'attempt_distractor_choices',
                           'variant_check_corrections', 'parameter_sets', 'item_parameters', 'tri_model_versions',
                           'essay_aggregation_rules']
  loop
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t);
  end loop;
end $$;
