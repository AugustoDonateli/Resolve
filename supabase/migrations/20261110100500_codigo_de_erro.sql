-- F5-T08 (ajuste): o erro gravado em job_runs/essay_jobs é só um código curto. A primeira versão limpava
-- caracteres, mas guardava o resto do texto, que poderia trazer trecho da redação ou da resposta do modelo.

create or replace function private.fail_run(p_run uuid, p_kind text, p_error text, p_in integer, p_out integer, p_model_served text,
                                 p_request_id text, p_now timestamptz)
returns text
language plpgsql set search_path = '' as $$
declare
  v_run public.job_runs%rowtype; j public.essay_jobs%rowtype; v_cost numeric; v_err text;
begin
  if p_kind not in ('erro', 'resultado_invalido', 'desconhecido') then
    raise exception 'resolve_run_kind_invalid' using errcode = 'P0001';
  end if;
  select * into v_run from public.job_runs where id = p_run for update;
  if not found then
    raise exception 'resolve_run_not_found' using errcode = 'P0001';
  end if;
  if v_run.status <> 'em_andamento' then
    return v_run.status;
  end if;
  -- só código curto (ex.: timeout, http:529, schema_invalido); texto livre poderia carregar trecho da redação
  v_err := case when lower(coalesce(p_error, '')) ~ '^[a-z0-9_]{1,40}(:[0-9]{1,3})?$' then lower(p_error) else 'erro_nao_classificado' end;
  if p_kind = 'desconhecido' and p_in is null then
    update public.ai_reservations set status = 'reconciliar' where id = v_run.reservation_id and status = 'reservada';
  elsif p_in is not null and p_out is not null then
    v_cost := private.record_usage(v_run.reservation_id, 'resposta', p_model_served, p_in, p_out, null, p_request_id, p_now);
    perform private.settle(v_run.reservation_id, 'liquidada', v_cost, p_now);
  else
    perform private.settle(v_run.reservation_id, 'liberada', null, p_now);
  end if;
  update public.job_runs set status = p_kind, finished_at = p_now, error_sanitized = v_err, request_id = left(p_request_id, 200) where id = p_run;
  select * into j from public.essay_jobs where id = v_run.job_id;
  update public.essay_jobs set status = 'nova_tentativa', auto_retry = (j.attempts < j.max_attempts), lease_until = null, last_error = v_err
   where id = j.id;
  return p_kind;
end;
$$;
revoke all on function private.fail_run(uuid, text, text, integer, integer, text, text, timestamptz) from public, anon, authenticated;
