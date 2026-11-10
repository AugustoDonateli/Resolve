-- F5-T08 — Fila de correção e reserva de custo. Critério do backlog: reenvio não duplica job;
-- concorrência não ultrapassa a reserva disponível.
--
-- Regras do plano:
--   * §3, regras 5–7: submissão cria versão imutável e trabalho com chave única. Cada etapa de IA reserva
--     orçamento antes da chamada. Timeout com resultado desconhecido gera reconciliação e limite de
--     repetição. Estados visíveis: Na fila, Em análise, Pronto, Precisa de nova tentativa, Limite atingido.
--   * §4.6: ai_usage, ai_budgets, job_runs.
--   * §10 G6: concorrência não reserva mais que o saldo; consumo possivelmente duplicado é registrado.
--   * §11: limite pessoal proposto de US$5/mês com aviso aos 70% (Guto confirma); preços de referência.
--
-- O consumidor (serviço de correção) chama as funções de private.* com uma conexão própria ao banco.
-- O app não usa a chave de serviço; essas funções não são expostas pela API.

-- ── Políticas de modelo (preço e tokens máximos por etapa) ────────────────────
create table public.ai_model_policies (
  id text primary key check (id ~ '^[a-z0-9.-]{3,60}$'),
  feature text not null check (feature in ('redacao_avaliacao', 'redacao_peca', 'etiquetagem')),
  provider text not null check (provider in ('anthropic')),
  model text not null check (char_length(model) between 1 and 80),
  max_input_tokens integer not null check (max_input_tokens between 1 and 1000000),
  max_output_tokens integer not null check (max_output_tokens between 1 and 128000),
  input_usd_per_mtok numeric(10, 4) not null check (input_usd_per_mtok >= 0),
  output_usd_per_mtok numeric(10, 4) not null check (output_usd_per_mtok >= 0),
  safety_factor numeric(4, 2) not null default 1.5 check (safety_factor between 1 and 3),
  status text not null default 'referencia' check (status in ('referencia', 'ativa', 'aposentada')),
  price_source text not null check (char_length(price_source) between 10 and 600),
  created_at timestamptz not null default now()
);
insert into public.ai_model_policies (id, feature, provider, model, max_input_tokens, max_output_tokens, input_usd_per_mtok, output_usd_per_mtok, safety_factor, status, price_source)
values ('redacao-ref-v0', 'redacao_avaliacao', 'anthropic', 'claude-sonnet-4-6', 4000, 1500, 3, 15, 1.5, 'referencia',
  'Plano §11 (IA recorrente da V1): Sonnet 4.6 a US$3/US$15 por milhão de tokens de entrada/saída; 4.000 de entrada + 1.500 de saída por avaliação; reserva de 50%. Referência para reservar: confirmar modelo e preço na página oficial antes das chamadas reais (F5-T09).');

-- Política só muda de estado (referência → ativa → aposentada); números e fonte não mudam.
create function private.guard_model_policy() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or (to_jsonb(new) - 'status') <> (to_jsonb(old) - 'status') then
    raise exception 'resolve_model_policy_immutable' using errcode = 'P0001', hint = 'Crie uma política nova.';
  end if;
  return new;
end;
$$;
create trigger ai_model_policies_guard before update or delete on public.ai_model_policies
  for each row execute function private.guard_model_policy();

-- Valor reservado por etapa: custo com os tokens máximos × fator de segurança.
create function private.reservation_amount(p public.ai_model_policies) returns numeric
language sql immutable set search_path = '' as $$
  select round((p.max_input_tokens * p.input_usd_per_mtok + p.max_output_tokens * p.output_usd_per_mtok) / 1000000.0 * p.safety_factor, 6);
$$;

-- ── Orçamento ────────────────────────────────────────────────────────────────
create table public.ai_budget_policies (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global', 'usuario')),
  user_id uuid references auth.users (id) on delete cascade,
  limit_usd numeric(10, 4) not null check (limit_usd > 0),
  warn_ratio numeric(3, 2) not null default 0.70 check (warn_ratio > 0 and warn_ratio <= 1),
  timezone text not null default 'America/Sao_Paulo',
  source_note text not null check (char_length(source_note) between 10 and 600),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((scope = 'usuario') = (user_id is not null))
);
create unique index ai_budget_policies_one_global on public.ai_budget_policies (scope) where scope = 'global' and active;
create unique index ai_budget_policies_one_per_user on public.ai_budget_policies (user_id) where scope = 'usuario' and active;
insert into public.ai_budget_policies (scope, limit_usd, warn_ratio, source_note) values
  ('global', 5, 0.70, 'Plano §11: proposta de limite inicial pessoal de US$5/mês de API, com aviso aos 70% e reserva antes de cada trabalho. Configuração sugerida para Guto confirmar.');

create table public.ai_budgets (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.ai_budget_policies (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  limit_usd numeric(10, 4) not null check (limit_usd > 0),
  reserved_usd numeric(12, 6) not null default 0 check (reserved_usd >= 0),
  consumed_usd numeric(12, 6) not null default 0 check (consumed_usd >= 0),
  updated_at timestamptz not null default now(),
  unique (policy_id, period_start),
  check (period_end > period_start)
);

-- ── Trabalhos: dona, etapa, tentativas e concessão ao consumidor ─────────────────
alter table public.essay_jobs
  add column user_id uuid references auth.users (id) on delete cascade,
  add column step text not null default 'avaliador_a' check (step in ('avaliador_a', 'avaliador_b', 'avaliador_c', 'concluido')),
  add column attempts smallint not null default 0 check (attempts >= 0),
  add column max_attempts smallint not null default 3 check (max_attempts between 1 and 10),
  add column auto_retry boolean not null default true,
  add column lease_until timestamptz,
  add column last_error text check (char_length(last_error) <= 300),
  add constraint essay_jobs_model_policy_fk foreign key (model_policy_id) references public.ai_model_policies (id);
create unique index essay_jobs_one_per_version on public.essay_jobs (version_id, rubric_id);
create index essay_jobs_queue on public.essay_jobs (created_at) where status in ('na_fila', 'nova_tentativa', 'em_analise');
create index essay_jobs_user on public.essay_jobs (user_id);
create index essay_jobs_policy on public.essay_jobs (model_policy_id);

create or replace function private.guard_essay_job() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.essay_versions v where v.id = new.version_id and v.status = 'submetida') then
    raise exception 'resolve_job_requires_submitted' using errcode = 'P0001', hint = 'Só versão submetida vai para correção.';
  end if;
  if tg_op = 'UPDATE' and (new.version_id <> old.version_id or new.rubric_id <> old.rubric_id or new.idempotency_key <> old.idempotency_key) then
    raise exception 'resolve_job_identity_changed' using errcode = 'P0001';
  end if;
  new.user_id := (select e.user_id from public.essay_versions v join public.essays e on e.id = v.essay_id where v.id = new.version_id);
  new.updated_at := now();
  return new;
end;
$$;

create table public.ai_reservations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.essay_jobs (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  step text not null check (step in ('avaliador_a', 'avaliador_b', 'avaliador_c')),
  model_policy_id text not null references public.ai_model_policies (id),
  amount_usd numeric(12, 6) not null check (amount_usd > 0),
  global_budget_id uuid not null references public.ai_budgets (id),
  user_budget_id uuid references public.ai_budgets (id),
  status text not null default 'reservada' check (status in ('reservada', 'liquidada', 'liberada', 'reconciliar')),
  consumed_usd numeric(12, 6) check (consumed_usd >= 0),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check ((status in ('liquidada', 'liberada')) = (settled_at is not null))
);
create unique index ai_reservations_one_open on public.ai_reservations (job_id, step) where status = 'reservada';
create index ai_reservations_job on public.ai_reservations (job_id);
create index ai_reservations_user on public.ai_reservations (user_id);
create index ai_reservations_global on public.ai_reservations (global_budget_id);
create index ai_reservations_user_budget on public.ai_reservations (user_budget_id);
create index ai_reservations_policy on public.ai_reservations (model_policy_id);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid unique references public.ai_reservations (id) on delete set null,
  job_id uuid references public.essay_jobs (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  feature text not null,
  provider text not null,
  model_requested text not null,
  model_served text,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  input_usd_per_mtok numeric(10, 4) not null,
  output_usd_per_mtok numeric(10, 4) not null,
  cost_estimated_usd numeric(12, 6) not null check (cost_estimated_usd >= 0),
  cost_billed_usd numeric(12, 6) check (cost_billed_usd >= 0),
  source text not null check (source in ('resposta', 'reconciliacao', 'estimativa_conservadora')),
  request_id text check (char_length(request_id) <= 200),
  created_at timestamptz not null default now()
);
create index ai_usage_job on public.ai_usage (job_id);
create index ai_usage_user on public.ai_usage (user_id);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.essay_jobs (id) on delete cascade,
  step text not null,
  attempt smallint not null check (attempt >= 1),
  worker_id text not null check (worker_id ~ '^[A-Za-z0-9._:-]{1,80}$'),
  status text not null default 'em_andamento' check (status in ('em_andamento', 'ok', 'erro', 'resultado_invalido', 'desconhecido')),
  reservation_id uuid references public.ai_reservations (id) on delete set null,
  started_at timestamptz not null,
  lease_until timestamptz not null,
  finished_at timestamptz,
  request_id text check (char_length(request_id) <= 200),
  -- código curto do erro, nunca texto da redação nem resposta do modelo
  error_sanitized text check (error_sanitized ~ '^[a-z0-9_:. -]{1,120}$'),
  check ((status = 'em_andamento') = (finished_at is null))
);
create unique index job_runs_one_open on public.job_runs (job_id) where status = 'em_andamento';
create index job_runs_reservation on public.job_runs (reservation_id);

-- ── Funções do consumidor (privadas) ─────────────────────────────────────────
-- Orçamento do período (mês no fuso da política), criado na primeira reserva do mês.
create function private.budget_for(p_policy uuid, p_now timestamptz) returns uuid
language plpgsql set search_path = '' as $$
declare
  pol public.ai_budget_policies%rowtype; v_start date; v_id uuid;
begin
  select * into pol from public.ai_budget_policies where id = p_policy;
  v_start := date_trunc('month', p_now at time zone private.valid_tz(pol.timezone))::date;
  insert into public.ai_budgets (policy_id, period_start, period_end, limit_usd)
  values (pol.id, v_start, (v_start + interval '1 month')::date, pol.limit_usd)
  on conflict (policy_id, period_start) do nothing;
  select id into v_id from public.ai_budgets where policy_id = pol.id and period_start = v_start;
  return v_id;
end;
$$;

-- Reserva a etapa do trabalho no orçamento global e no da conta (se houver). Nulo = sem saldo.
-- Trava as linhas de orçamento em ordem fixa: reservas simultâneas entram em fila e nenhuma passa do limite.
create function private.reserve(p_job uuid, p_step text, p_now timestamptz) returns uuid
language plpgsql set search_path = '' as $$
declare
  j public.essay_jobs%rowtype; mp public.ai_model_policies%rowtype;
  v_amount numeric; v_g uuid; v_u uuid; v_id uuid; v_gpol uuid; v_upol uuid;
begin
  select * into j from public.essay_jobs where id = p_job;
  select id into v_id from public.ai_reservations where job_id = p_job and step = p_step and status = 'reservada';
  if v_id is not null then
    return v_id; -- já reservada (reenvio)
  end if;
  select * into mp from public.ai_model_policies where id = j.model_policy_id;
  v_amount := private.reservation_amount(mp);
  select id into v_gpol from public.ai_budget_policies where scope = 'global' and active;
  if v_gpol is null then
    return null;
  end if;
  select id into v_upol from public.ai_budget_policies where scope = 'usuario' and active and user_id = j.user_id;
  v_g := private.budget_for(v_gpol, p_now);
  if v_upol is not null then
    v_u := private.budget_for(v_upol, p_now);
  end if;
  perform 1 from public.ai_budgets b where b.id in (v_g, v_u) order by b.id for update;
  if exists (select 1 from public.ai_budgets b where b.id in (v_g, v_u) and b.limit_usd - b.reserved_usd - b.consumed_usd < v_amount) then
    return null;
  end if;
  update public.ai_budgets set reserved_usd = reserved_usd + v_amount, updated_at = p_now where id in (v_g, v_u);
  insert into public.ai_reservations (job_id, user_id, step, model_policy_id, amount_usd, global_budget_id, user_budget_id, created_at)
  values (p_job, j.user_id, p_step, mp.id, v_amount, v_g, v_u, p_now)
  returning id into v_id;
  return v_id;
end;
$$;

-- Libera ou liquida uma reserva: o reservado sai do orçamento; o consumido (se houver) entra.
create function private.settle(p_reservation uuid, p_status text, p_consumed numeric, p_now timestamptz) returns void
language plpgsql set search_path = '' as $$
declare
  r public.ai_reservations%rowtype;
begin
  select * into r from public.ai_reservations where id = p_reservation for update;
  if r.status not in ('reservada', 'reconciliar') then
    return; -- já resolvida (entrega repetida)
  end if;
  perform 1 from public.ai_budgets b where b.id in (r.global_budget_id, r.user_budget_id) order by b.id for update;
  update public.ai_budgets
     set reserved_usd = reserved_usd - r.amount_usd, consumed_usd = consumed_usd + coalesce(p_consumed, 0), updated_at = p_now
   where id in (r.global_budget_id, r.user_budget_id);
  update public.ai_reservations set status = p_status, consumed_usd = p_consumed, settled_at = p_now where id = r.id;
end;
$$;

create function private.record_usage(p_reservation uuid, p_source text, p_model_served text, p_in integer, p_out integer,
                                     p_billed numeric, p_request_id text, p_now timestamptz) returns numeric
language plpgsql set search_path = '' as $$
declare
  r public.ai_reservations%rowtype; mp public.ai_model_policies%rowtype; v_cost numeric;
begin
  select * into r from public.ai_reservations where id = p_reservation;
  select * into mp from public.ai_model_policies where id = r.model_policy_id;
  if p_in is not null and p_out is not null then
    v_cost := round((p_in * mp.input_usd_per_mtok + p_out * mp.output_usd_per_mtok) / 1000000.0, 6);
  elsif p_billed is not null then
    v_cost := p_billed;
  else
    v_cost := r.amount_usd; -- desconhecido: registra o máximo reservado, sem esconder consumo possível
  end if;
  insert into public.ai_usage (reservation_id, job_id, user_id, feature, provider, model_requested, model_served, input_tokens, output_tokens,
                               input_usd_per_mtok, output_usd_per_mtok, cost_estimated_usd, cost_billed_usd, source, request_id, created_at)
  values (r.id, r.job_id, r.user_id, mp.feature, mp.provider, mp.model, p_model_served, p_in, p_out,
          mp.input_usd_per_mtok, mp.output_usd_per_mtok, v_cost, p_billed, p_source, left(p_request_id, 200), p_now)
  on conflict (reservation_id) do nothing;
  return v_cost;
end;
$$;

-- Próximo trabalho para o consumidor: expira concessões vencidas (resultado desconhecido → reconciliar),
-- reserva a etapa e abre a execução. Nada a fazer → nenhuma linha.
create function private.claim_next_job(p_worker text, p_now timestamptz, p_lease_seconds integer default 300)
returns table (run_id uuid, job_id uuid, version_id uuid, step text, attempt smallint, reservation_id uuid)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  j public.essay_jobs%rowtype; v_run public.job_runs%rowtype; v_res uuid; v_tries int := 0;
begin
  -- concessão vencida: a chamada pode ter sido feita e cobrada; o resultado é desconhecido
  for v_run in select * from public.job_runs r where r.status = 'em_andamento' and r.lease_until < p_now for update skip locked loop
    perform private.fail_run(v_run.id, 'desconhecido', 'lease_expired', null, null, null, null, p_now);
  end loop;

  loop
    v_tries := v_tries + 1;
    exit when v_tries > 20;
    select * into j from public.essay_jobs ej
     where ej.status = 'na_fila' or (ej.status = 'nova_tentativa' and ej.auto_retry)
     order by ej.created_at
     for update skip locked limit 1;
    if not found then
      return;
    end if;
    v_res := private.reserve(j.id, j.step, p_now);
    if v_res is null then
      update public.essay_jobs set status = 'limite_atingido', last_error = 'budget_exhausted' where id = j.id;
      continue;
    end if;
    update public.essay_jobs set status = 'em_analise', attempts = attempts + 1, lease_until = p_now + make_interval(secs => p_lease_seconds)
     where id = j.id returning * into j;
    insert into public.job_runs (job_id, step, attempt, worker_id, reservation_id, started_at, lease_until)
    values (j.id, j.step, j.attempts, p_worker, v_res, p_now, j.lease_until)
    returning * into v_run;
    return query select v_run.id, j.id, j.version_id, j.step, j.attempts, v_res;
    return;
  end loop;
end;
$$;

-- Etapa concluída: registra o uso real, liquida a reserva e encerra a execução. Repetir é inofensivo.
create function private.complete_run(p_run uuid, p_model_served text, p_in integer, p_out integer, p_request_id text, p_now timestamptz)
returns text
language plpgsql set search_path = '' as $$
declare
  v_run public.job_runs%rowtype; v_cost numeric;
begin
  select * into v_run from public.job_runs where id = p_run for update;
  if not found then
    raise exception 'resolve_run_not_found' using errcode = 'P0001';
  end if;
  if v_run.status <> 'em_andamento' then
    return v_run.status; -- entrega repetida: nada muda
  end if;
  v_cost := private.record_usage(v_run.reservation_id, 'resposta', p_model_served, p_in, p_out, null, p_request_id, p_now);
  perform private.settle(v_run.reservation_id, 'liquidada', v_cost, p_now);
  update public.job_runs set status = 'ok', finished_at = p_now, request_id = left(p_request_id, 200) where id = p_run;
  -- consumidor de uma etapa: a etapa seguinte (avaliador B, F5-T10) entra quando existir
  update public.essay_jobs set status = 'pronto', step = 'concluido', lease_until = null, last_error = null where id = v_run.job_id;
  return 'ok';
end;
$$;

-- Etapa falhou:
--   * erro ou resultado inválido com uso informado: o consumo é registrado;
--   * erro sem uso: a reserva é liberada;
--   * resultado desconhecido (timeout, concessão vencida): a reserva fica para reconciliar.
-- O trabalho volta como "nova tentativa" até o limite de tentativas; depois para de repetir sozinho.
create function private.fail_run(p_run uuid, p_kind text, p_error text, p_in integer, p_out integer, p_model_served text,
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
  v_err := coalesce(nullif(left(regexp_replace(lower(coalesce(p_error, '')), '[^a-z0-9_:. -]', '', 'g'), 120), ''), 'erro');
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

-- Reconciliação de resultado desconhecido: com tokens ou valor faturado do provedor, registra o real;
-- sem informação, registra o máximo reservado (estimativa conservadora, identificada como tal).
create function private.reconcile_reservation(p_reservation uuid, p_in integer, p_out integer, p_billed numeric, p_request_id text, p_now timestamptz)
returns numeric
language plpgsql set search_path = '' as $$
declare
  r public.ai_reservations%rowtype; v_cost numeric;
begin
  select * into r from public.ai_reservations where id = p_reservation for update;
  if r.status <> 'reconciliar' then
    raise exception 'resolve_reservation_not_pending' using errcode = 'P0001';
  end if;
  v_cost := private.record_usage(r.id, case when p_in is null and p_billed is null then 'estimativa_conservadora' else 'reconciliacao' end,
                                 null, p_in, p_out, p_billed, p_request_id, p_now);
  perform private.settle(r.id, 'liquidada', v_cost, p_now);
  return v_cost;
end;
$$;

-- ── Funções da conta ─────────────────────────────────────────────────────────
-- Envia a versão para correção: congela a versão (se ainda for rascunho), cria UM trabalho por versão
-- e reserva a primeira etapa. A mesma chave (ou a mesma versão) devolve o trabalho existente.
create function public.submit_essay(p_version_id uuid, p_idempotency_key text)
returns table (job_id uuid, status text, duplicate boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v public.essay_versions%rowtype; v_owner uuid; j public.essay_jobs%rowtype; v_rubric uuid; v_policy text;
begin
  if v_uid is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{8,120}$' then
    raise exception 'resolve_idempotency_key_invalid' using errcode = 'P0001';
  end if;
  -- trava a versão: envios simultâneos da mesma versão entram em fila
  select * into v from public.essay_versions ev where ev.id = p_version_id for update;
  select e.user_id into v_owner from public.essays e where e.id = v.essay_id;
  if v.id is null or v_owner is distinct from v_uid then
    raise exception 'resolve_essay_not_found' using errcode = 'P0001';
  end if;
  select * into j from public.essay_jobs ej where ej.idempotency_key = p_idempotency_key;
  if found and j.version_id <> p_version_id then
    raise exception 'resolve_action_reused' using errcode = 'P0001', hint = 'Chave já usada em outro envio.';
  end if;
  if not found then
    select * into j from public.essay_jobs ej where ej.version_id = p_version_id order by ej.created_at limit 1;
  end if;
  if found then
    return query select j.id, j.status, true;
    return;
  end if;
  if v.status = 'rascunho' then
    update public.essay_versions set status = 'submetida' where id = v.id;
  end if;
  select r.id into v_rubric from public.essay_rubrics r where r.version = 'enem-redacao-v1';
  select mp.id into v_policy from public.ai_model_policies mp
   where mp.feature = 'redacao_avaliacao' and mp.status in ('ativa', 'referencia')
   order by (mp.status = 'ativa') desc, mp.created_at desc limit 1;
  if v_policy is null then
    raise exception 'resolve_no_model_policy' using errcode = 'P0001';
  end if;
  insert into public.essay_jobs (version_id, rubric_id, model_policy_id, idempotency_key)
  values (v.id, v_rubric, v_policy, p_idempotency_key)
  returning * into j;
  if private.reserve(j.id, j.step, now()) is null then
    update public.essay_jobs set status = 'limite_atingido', last_error = 'budget_exhausted' where id = j.id returning * into j;
  end if;
  return query select j.id, j.status, false;
end;
$$;

-- Pede de novo um trabalho parado ("Limite atingido" ou "Precisa de nova tentativa" sem repetição automática).
create function public.retry_essay_job(p_job_id uuid)
returns table (job_id uuid, status text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  j public.essay_jobs%rowtype;
begin
  select * into j from public.essay_jobs ej where ej.id = p_job_id for update;
  if not found or j.user_id is distinct from auth.uid() then
    raise exception 'resolve_job_not_found' using errcode = 'P0001';
  end if;
  if j.status = 'limite_atingido' then
    if private.reserve(j.id, j.step, now()) is null then
      return query select j.id, j.status;
      return;
    end if;
    update public.essay_jobs set status = 'na_fila', last_error = null where id = j.id returning * into j;
  elsif j.status = 'nova_tentativa' and not j.auto_retry then
    update public.essay_jobs set attempts = 0, auto_retry = true where id = j.id returning * into j;
  end if;
  return query select j.id, j.status;
end;
$$;

-- ── Acesso ───────────────────────────────────────────────────────────────────
alter table public.ai_model_policies enable row level security;
alter table public.ai_budget_policies enable row level security;
alter table public.ai_budgets enable row level security;
alter table public.ai_reservations enable row level security;
alter table public.ai_usage enable row level security;
alter table public.job_runs enable row level security;
revoke all on public.ai_model_policies, public.ai_budget_policies, public.ai_budgets, public.ai_reservations, public.ai_usage, public.job_runs
  from anon, authenticated;
grant select on public.ai_model_policies, public.ai_budget_policies, public.ai_budgets, public.ai_reservations, public.ai_usage, public.job_runs to authenticated;
create policy "políticas de modelo: contas leem" on public.ai_model_policies for select to authenticated using (true);
create policy "orçamento: editor lê" on public.ai_budget_policies for select to authenticated using ((select public.is_editor()));
create policy "orçamento do período: editor lê" on public.ai_budgets for select to authenticated using ((select public.is_editor()));
create policy "reservas: editor lê" on public.ai_reservations for select to authenticated using ((select public.is_editor()));
create policy "uso de IA: a própria conta ou editor" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_editor()));
create policy "execuções: da própria correção" on public.job_runs for select to authenticated
  using (exists (select 1 from public.essay_jobs j where j.id = job_runs.job_id and j.user_id = (select auth.uid())));

revoke all on function private.guard_model_policy(), private.reservation_amount(public.ai_model_policies),
  private.budget_for(uuid, timestamptz), private.reserve(uuid, text, timestamptz), private.settle(uuid, text, numeric, timestamptz),
  private.record_usage(uuid, text, text, integer, integer, numeric, text, timestamptz),
  private.claim_next_job(text, timestamptz, integer), private.complete_run(uuid, text, integer, integer, text, timestamptz),
  private.fail_run(uuid, text, text, integer, integer, text, text, timestamptz),
  private.reconcile_reservation(uuid, integer, integer, numeric, text, timestamptz), private.guard_essay_job()
  from public, anon, authenticated;
revoke all on function public.submit_essay(uuid, text), public.retry_essay_job(uuid) from public, anon;
grant execute on function public.submit_essay(uuid, text), public.retry_essay_job(uuid) to authenticated;
