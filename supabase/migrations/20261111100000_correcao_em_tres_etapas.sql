-- Correção em etapas: avaliador A, avaliador B, regra de discrepância e avaliador C quando necessário.
-- Cada etapa grava a avaliação (imutável) e as anotações presas ao texto; ao fim, o resultado guarda a
-- divergência entre avaliações e fica "não calibrado" até existir uma calibração registrada.
--
-- Regra de discrepância: limites da premissa do plano (§ Redação): mais de 100 pontos no total ou mais
-- de 80 em alguma competência aciona o avaliador C. A fonte oficial do Inep ainda não foi conferida;
-- quando for, entra como nova versão da regra (a tabela é só de acréscimo).
-- Consolidação (centro interno): média das duas ou mediana das três — regra da plataforma, não do Inep.

create table public.essay_aggregation_rules (
  version text primary key check (version ~ '^[a-z0-9.-]{1,40}$'),
  total_gt smallint not null check (total_gt between 0 and 1000),
  competency_gt smallint not null check (competency_gt between 0 and 200),
  consolidation text not null check (consolidation in ('media_ou_mediana')),
  source_note text not null check (char_length(source_note) between 10 and 600),
  status text not null default 'ativa' check (status in ('ativa', 'retirada')),
  created_at timestamptz not null default now()
);
create unique index essay_aggregation_rules_one_active on public.essay_aggregation_rules ((true)) where status = 'ativa';
create trigger essay_aggregation_rules_append_only before update or delete on public.essay_aggregation_rules
  for each row execute function private.guard_model_policy();

insert into public.essay_aggregation_rules (version, total_gt, competency_gt, consolidation, source_note)
values ('discrepancia-plano-v1', 100, 80, 'media_ou_mediana',
        'Limites da premissa do plano (Resolve-pacote, § Redação e testes 100/101 e 80/81). Fonte oficial do Inep pendente de conferência. Consolidação por média de duas ou mediana de três é regra da plataforma.');

alter table public.essay_jobs add column aggregation_version text references public.essay_aggregation_rules (version);
alter table public.essay_results add column center smallint check (center between 0 and 1000);
alter table public.essay_results add column evaluator_count smallint check (evaluator_count between 2 and 3);
alter table public.essay_results add column discrepancy boolean;
alter table public.essay_evaluations add column intervention jsonb check (intervention is null or jsonb_typeof(intervention) = 'object');

alter table public.essay_aggregation_rules enable row level security;
grant select on public.essay_aggregation_rules to authenticated;
create policy "regras de consolidação: contas leem" on public.essay_aggregation_rules for select to authenticated using (true);

-- Há discrepância entre A e B?
create function private.essay_discrepant(p_job uuid, p_rule text) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(
    abs(a.total - b.total) > r.total_gt
    or exists (select 1 from jsonb_each(a.scores) s
               where abs((s.value)::text::int - (b.scores->>s.key)::int) > r.competency_gt),
    false)
  from public.essay_evaluations a
  join public.essay_evaluations b on b.job_id = a.job_id and b.evaluator_slot = 'B'
  join public.essay_aggregation_rules r on r.version = p_rule
  where a.job_id = p_job and a.evaluator_slot = 'A';
$$;

-- Resultado: divergência (menor e maior total considerado) e centro interno; sempre "não calibrado" aqui.
create function private.consolidate_essay(p_job uuid, p_rule text, p_now timestamptz) returns void
language plpgsql set search_path = '' as $$
declare
  v_totals int[]; v_n int; v_center int; v_disc boolean;
begin
  v_totals := array(select e.total from public.essay_evaluations e where e.job_id = p_job order by e.total);
  v_n := cardinality(v_totals);
  if v_n not in (2, 3) then
    raise exception 'resolve_consolidation_count' using errcode = 'P0001';
  end if;
  v_center := case v_n when 2 then round((v_totals[1] + v_totals[2]) / 2.0) else v_totals[2] end;
  v_disc := private.essay_discrepant(p_job, p_rule);
  insert into public.essay_results (job_id, aggregation_version, evaluator_lower, evaluator_upper, center, evaluator_count,
                                    discrepancy, status, created_at)
  values (p_job, p_rule, v_totals[1], v_totals[v_n], v_center, v_n, v_disc, 'nao_calibrado', p_now)
  on conflict (job_id) do nothing;
  update public.essay_jobs set status = 'pronto', step = 'concluido', lease_until = null, last_error = null where id = p_job;
end;
$$;

-- Etapa concluída com avaliação: uso real, liquidação, avaliação imutável, anotações e próxima etapa.
-- p_annotations: [{competency, intervention_element?, absent, paragraph_id?, start_utf16?, end_utf16?, comment}].
-- Anotação que não confere com o texto é descartada (as notas continuam valendo). Repetir é inofensivo.
create function private.complete_evaluation(p_run uuid, p_scores jsonb, p_total integer, p_feedback text, p_intervention jsonb,
                                            p_annotations jsonb, p_model_served text, p_prompt_version text,
                                            p_in integer, p_out integer, p_request_id text, p_now timestamptz)
returns text
language plpgsql set search_path = '' as $$
declare
  v_run public.job_runs%rowtype; j public.essay_jobs%rowtype; v_cost numeric; v_eval uuid; v_slot text; a jsonb;
  v_rule text; v_skipped int := 0;
begin
  select * into v_run from public.job_runs where id = p_run for update;
  if not found then
    raise exception 'resolve_run_not_found' using errcode = 'P0001';
  end if;
  if v_run.status <> 'em_andamento' then
    return v_run.status;
  end if;
  select * into j from public.essay_jobs where id = v_run.job_id for update;
  v_slot := case v_run.step when 'avaliador_a' then 'A' when 'avaliador_b' then 'B' when 'avaliador_c' then 'C' end;
  if v_slot is null then
    raise exception 'resolve_run_step_invalid' using errcode = 'P0001';
  end if;
  v_cost := private.record_usage(v_run.reservation_id, 'resposta', p_model_served, p_in, p_out, null, p_request_id, p_now);
  perform private.settle(v_run.reservation_id, 'liquidada', v_cost, p_now);

  insert into public.essay_evaluations (job_id, evaluator_slot, scores, total, evidence, feedback, model_id, prompt_version, intervention, created_at)
  values (j.id, v_slot, p_scores, p_total, '[]'::jsonb, nullif(left(coalesce(p_feedback, ''), 8000), ''), left(p_model_served, 80),
          left(p_prompt_version, 60), p_intervention, p_now)
  returning id into v_eval;
  for a in select * from jsonb_array_elements(coalesce(p_annotations, '[]'::jsonb)) loop
    begin
      insert into public.essay_annotations (evaluation_id, competency, intervention_element, absent, paragraph_id, start_utf16, end_utf16, comment)
      values (v_eval, a->>'competency', a->>'intervention_element', coalesce((a->>'absent')::boolean, false), a->>'paragraph_id',
              (a->>'start_utf16')::int, (a->>'end_utf16')::int, left(a->>'comment', 2000));
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;
  update public.job_runs set status = 'ok', finished_at = p_now, request_id = left(p_request_id, 200),
         error_sanitized = case when v_skipped > 0 then format('anotacoes_descartadas:%s', v_skipped) end
   where id = p_run;

  v_rule := coalesce(j.aggregation_version, (select r.version from public.essay_aggregation_rules r where r.status = 'ativa'));
  if j.aggregation_version is null then
    update public.essay_jobs set aggregation_version = v_rule where id = j.id;
  end if;
  if v_slot = 'A' then
    update public.essay_jobs set step = 'avaliador_b', status = 'na_fila', attempts = 0, auto_retry = true, lease_until = null, last_error = null
     where id = j.id;
  elsif v_slot = 'B' and private.essay_discrepant(j.id, v_rule) then
    update public.essay_jobs set step = 'avaliador_c', status = 'na_fila', attempts = 0, auto_retry = true, lease_until = null, last_error = null
     where id = j.id;
  else
    perform private.consolidate_essay(j.id, v_rule, p_now);
  end if;
  return 'ok';
end;
$$;

-- ── Funções do serviço de correção (Edge Function com credencial de serviço; nunca o app) ──────────
create function public.worker_claim(p_worker text) returns table (run_id uuid, job_id uuid, version_id uuid, step text, attempt smallint)
language sql security definer set search_path = '' as $$
  select c.run_id, c.job_id, c.version_id, c.step, c.attempt from private.claim_next_job(p_worker, now()) c;
$$;

-- Só o texto submetido e a rubrica (nenhuma avaliação anterior: independência entre avaliadores).
create function public.worker_load(p_run uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'paragraphs', v.paragraphs_json,
    'plain_text', v.plain_text,
    'codes', (select jsonb_agg(d.code order by d.position) from public.rubric_dimensions d where d.rubric_id = j.rubric_id),
    'allowed_scores', to_jsonb(r.allowed_scores),
    'model', mp.model,
    'max_output_tokens', mp.max_output_tokens,
    'policy_status', mp.status)
  from public.job_runs jr
  join public.essay_jobs j on j.id = jr.job_id
  join public.essay_versions v on v.id = j.version_id
  join public.essay_rubrics r on r.id = j.rubric_id
  join public.ai_model_policies mp on mp.id = j.model_policy_id
  where jr.id = p_run;
$$;

create function public.worker_complete(p_run uuid, p_scores jsonb, p_total integer, p_feedback text, p_intervention jsonb,
                                       p_annotations jsonb, p_model_served text, p_prompt_version text,
                                       p_in integer, p_out integer, p_request_id text)
returns text language sql security definer set search_path = '' as $$
  select private.complete_evaluation(p_run, p_scores, p_total, p_feedback, p_intervention, p_annotations, p_model_served,
                                     p_prompt_version, p_in, p_out, p_request_id, now());
$$;

create function public.worker_fail(p_run uuid, p_kind text, p_error text, p_in integer, p_out integer, p_model_served text, p_request_id text)
returns text language sql security definer set search_path = '' as $$
  select private.fail_run(p_run, p_kind, p_error, p_in, p_out, p_model_served, p_request_id, now());
$$;

revoke all on function public.worker_claim(text) from public, anon, authenticated;
revoke all on function public.worker_load(uuid) from public, anon, authenticated;
revoke all on function public.worker_complete(uuid, jsonb, integer, text, jsonb, jsonb, text, text, integer, integer, text) from public, anon, authenticated;
revoke all on function public.worker_fail(uuid, text, text, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.worker_claim(text) to service_role;
grant execute on function public.worker_load(uuid) to service_role;
grant execute on function public.worker_complete(uuid, jsonb, integer, text, jsonb, jsonb, text, text, integer, integer, text) to service_role;
grant execute on function public.worker_fail(uuid, text, text, integer, integer, text, text) to service_role;
