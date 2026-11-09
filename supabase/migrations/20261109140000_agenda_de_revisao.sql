-- F3-T07 — Agenda de revisão. Plano §7 ("Revisão") e §10 (G2): intervalos de 1, 3, 7, 14 e 30 dias,
-- versionados; um erro reinicia a sequência; acerto com ajuda não avança como independente; a fila
-- prioriza vencidos e o tempo disponível define o lote, com o restante visível. O vencimento é uma
-- data do calendário local do aluno (fuso do perfil), sem duplicação por reenvio (um evento por tentativa).
-- A regra recebe o instante como parâmetro: relógio do servidor na resposta, relógio controlado nos testes.

create table public.review_schedulers (
  version text primary key check (version ~ '^[a-z0-9.-]{1,40}$'),
  intervals_days smallint[] not null check (cardinality(intervals_days) between 1 and 12),
  minutes_per_item smallint not null check (minutes_per_item between 1 and 30),
  source_note text not null,
  created_at timestamptz not null default now()
);
insert into public.review_schedulers (version, intervals_days, minutes_per_item, source_note) values
  ('srs-v1', '{1,3,7,14,30}', 3,
   'Plano §7 (Revisão): intervalos iniciais de 1, 3, 7, 14 e 30 dias. Lote: 3 minutos por item, alvo inicial de ritmo do plano (§7, Durações dos treinos); configurável em nova versão.');
create trigger review_schedulers_append_only before update or delete on public.review_schedulers
  for each row execute function private.block_update();

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id),
  scheduler_version text not null references public.review_schedulers (version),
  stage smallint not null default 0 check (stage >= 0),
  status text not null default 'ativa' check (status in ('ativa', 'concluida')),
  due_date date not null,
  timezone text not null,
  last_attempt_id uuid references public.attempts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'concluida') = (completed_at is not null))
);
create unique index review_items_active on public.review_items (user_id, item_id) where status = 'ativa';

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid not null references public.review_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id uuid not null unique references public.attempts (id) on delete cascade,
  outcome text not null check (outcome in ('erro', 'acerto', 'acerto_com_ajuda', 'acerto_antecipado', 'concluida')),
  stage_before smallint,
  stage_after smallint not null,
  due_before date,
  due_after date,
  local_date date not null,
  timezone text not null,
  scheduler_version text not null references public.review_schedulers (version),
  applied_at timestamptz not null
);

-- Fuso do perfil, validado contra a base de fusos do servidor (inválido → padrão do perfil).
create function private.valid_tz(tz text) returns text
language sql stable set search_path = '' as $$
  select coalesce((select n.name from pg_catalog.pg_timezone_names n where n.name = tz limit 1), 'America/Sao_Paulo');
$$;

-- Aplica uma tentativa à agenda. Devolve o resultado (ou nulo quando não há o que agendar).
create function private.apply_review(p_attempt uuid, p_now timestamptz) returns text
language plpgsql set search_path = '' as $$
declare
  a public.attempts%rowtype;
  s public.review_schedulers%rowtype;
  r public.review_items%rowtype;
  v_tz text; v_local date; v_due date; v_n int; v_out text; v_stage int;
begin
  if exists (select 1 from public.review_events e where e.attempt_id = p_attempt) then
    return null; -- reenvio: já aplicada
  end if;
  select * into a from public.attempts where id = p_attempt;
  if not found or a.is_correct is null then
    return null; -- item anulado: fora da agenda
  end if;
  select * into s from public.review_schedulers where version = 'srs-v1';
  v_n := cardinality(s.intervals_days);
  v_tz := private.valid_tz((select p.timezone from public.profiles p where p.user_id = a.user_id));
  v_local := (p_now at time zone v_tz)::date;
  select * into r from public.review_items ri where ri.user_id = a.user_id and ri.item_id = a.item_id and ri.status = 'ativa' for update;

  if a.is_correct = false then
    -- erro: começa (ou reinicia) a sequência no primeiro intervalo
    v_due := v_local + s.intervals_days[1];
    if r.id is null then
      insert into public.review_items (user_id, item_id, scheduler_version, stage, due_date, timezone, last_attempt_id, created_at, updated_at)
      values (a.user_id, a.item_id, s.version, 0, v_due, v_tz, a.id, p_now, p_now)
      returning * into r;
      insert into public.review_events (review_item_id, user_id, attempt_id, outcome, stage_before, stage_after, due_before, due_after, local_date, timezone, scheduler_version, applied_at)
      values (r.id, a.user_id, a.id, 'erro', null, 0, null, v_due, v_local, v_tz, s.version, p_now);
    else
      insert into public.review_events (review_item_id, user_id, attempt_id, outcome, stage_before, stage_after, due_before, due_after, local_date, timezone, scheduler_version, applied_at)
      values (r.id, a.user_id, a.id, 'erro', r.stage, 0, r.due_date, v_due, v_local, v_tz, s.version, p_now);
      update public.review_items set stage = 0, due_date = v_due, timezone = v_tz, last_attempt_id = a.id, updated_at = p_now where id = r.id;
    end if;
    return 'erro';
  end if;

  if r.id is null then
    return null; -- acerto sem revisão pendente: nada a agendar
  end if;
  v_stage := r.stage;
  if v_local < r.due_date then
    v_out := 'acerto_antecipado'; v_due := r.due_date;            -- antes do vencimento: não conta
  elsif a.help_seen then
    v_out := 'acerto_com_ajuda'; v_due := v_local + s.intervals_days[v_stage + 1]; -- repete o intervalo
  elsif v_stage + 1 >= v_n then
    v_out := 'concluida'; v_due := null; v_stage := v_stage + 1;  -- último intervalo cumprido
  else
    v_out := 'acerto'; v_stage := v_stage + 1; v_due := v_local + s.intervals_days[v_stage + 1];
  end if;
  insert into public.review_events (review_item_id, user_id, attempt_id, outcome, stage_before, stage_after, due_before, due_after, local_date, timezone, scheduler_version, applied_at)
  values (r.id, a.user_id, a.id, v_out, r.stage, v_stage, r.due_date, v_due, v_local, v_tz, s.version, p_now);
  if v_out = 'concluida' then
    update public.review_items set stage = v_stage, status = 'concluida', completed_at = p_now, last_attempt_id = a.id, updated_at = p_now where id = r.id;
    -- caderno de erros: o erro sai da lista ativa quando a sequência de revisão termina
    update public.error_entries set resolved_at = p_now, updated_at = p_now
     where user_id = a.user_id and item_id = a.item_id and resolved_at is null;
  elsif v_out <> 'acerto_antecipado' then
    update public.review_items set stage = v_stage, due_date = v_due, timezone = v_tz, last_attempt_id = a.id, updated_at = p_now where id = r.id;
  end if;
  return v_out;
end;
$$;

-- Fila do dia: vencidos primeiro (mais atrasados antes); o tempo disponível define o lote e o resto
-- continua visível (in_batch = false), sem impor uma dívida impossível.
create function private.review_queue_for(p_user uuid, p_now timestamptz, p_available_minutes integer)
returns table (review_item_id uuid, item_id uuid, item_version_id uuid, due_date date, days_overdue integer,
               stage smallint, queue_position integer, in_batch boolean, local_date date, minutes_per_item smallint)
language sql stable set search_path = '' as $$
  with cfg as (
    select s.minutes_per_item, (p_now at time zone private.valid_tz((select p.timezone from public.profiles p where p.user_id = p_user)))::date as today
    from public.review_schedulers s where s.version = 'srs-v1'
  ), due as (
    select ri.id, ri.item_id, ri.due_date, ri.stage,
           (select iv.id from public.item_versions iv where iv.item_id = ri.item_id and iv.review_status = 'published' order by iv.version desc limit 1) as iv_id,
           row_number() over (order by ri.due_date, ri.stage, ri.created_at, ri.id) as pos
    from public.review_items ri, cfg
    where ri.user_id = p_user and ri.status = 'ativa' and ri.due_date <= cfg.today
  )
  select d.id, d.item_id, d.iv_id, d.due_date, (cfg.today - d.due_date)::integer, d.stage, d.pos::integer,
         d.pos <= greatest(0, coalesce(p_available_minutes, 0)) / cfg.minutes_per_item, cfg.today, cfg.minutes_per_item
  from due d, cfg
  order by d.pos;
$$;

create function public.review_queue(p_available_minutes integer default 30)
returns table (review_item_id uuid, item_id uuid, item_version_id uuid, due_date date, days_overdue integer,
               stage smallint, queue_position integer, in_batch boolean, local_date date, minutes_per_item smallint)
language sql stable security definer set search_path = '' as $$
  select * from private.review_queue_for(auth.uid(), now(), p_available_minutes) where auth.uid() is not null;
$$;
revoke all on function public.review_queue(integer) from public, anon;
grant execute on function public.review_queue(integer) to authenticated;

alter table public.review_schedulers enable row level security;
alter table public.review_items enable row level security;
alter table public.review_events enable row level security;
revoke all on public.review_schedulers, public.review_items, public.review_events from anon, authenticated;
grant select on public.review_schedulers, public.review_items, public.review_events to authenticated;
create policy "agendas: contas leem" on public.review_schedulers for select to authenticated using (true);
create policy "revisões: as próprias" on public.review_items for select to authenticated using (user_id = (select auth.uid()));
create policy "histórico de revisão: o próprio" on public.review_events for select to authenticated using (user_id = (select auth.uid()));

create index review_items_user_due on public.review_items (user_id, due_date) where status = 'ativa';
create index review_items_item on public.review_items (item_id);
create index review_items_last_attempt on public.review_items (last_attempt_id);
create index review_items_scheduler on public.review_items (scheduler_version);
create index review_events_item on public.review_events (review_item_id);
create index review_events_user on public.review_events (user_id);
create index review_events_scheduler on public.review_events (scheduler_version);

-- Confirmar resposta agora também agenda a revisão (mesma transação).
-- Confirma a resposta. Uma tentativa lógica por ação; o acerto é do servidor; gabarito só depois.
create or replace function public.submit_attempt(p_client_action_id uuid, p_session_item_id uuid, p_alternative_id uuid,
                                      p_confidence integer default null, p_help_seen boolean default false,
                                      p_active_ms integer default null, p_elapsed_ms integer default null)
returns table (attempt_id uuid, is_correct boolean, correct_alternative_id uuid, is_repeat boolean, help_seen boolean,
               duplicate boolean, error_entry_id uuid)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_si public.session_items%rowtype; v_s public.study_sessions%rowtype;
  v_att public.attempts%rowtype; v_alt public.alternatives%rowtype;
  v_item uuid; v_annulled boolean; v_err uuid; v_correct uuid; v_help boolean; v_dup boolean := false;
begin
  if v_uid is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  -- trava o item da sessão: envios simultâneos da mesma questão ficam em fila
  select * into v_si from public.session_items where id = p_session_item_id for update;
  if not found then
    raise exception 'resolve_session_item_not_found' using errcode = 'P0001';
  end if;
  select * into v_s from public.study_sessions where id = v_si.session_id;
  if v_s.user_id <> v_uid then
    raise exception 'resolve_session_item_not_found' using errcode = 'P0001'; -- não revela itens de outra conta
  end if;

  select * into v_att from public.attempts a where a.user_id = v_uid and a.client_action_id = p_client_action_id;
  if found then
    if v_att.session_item_id <> p_session_item_id or v_att.chosen_alternative_id <> p_alternative_id then
      raise exception 'resolve_action_reused' using errcode = 'P0001', hint = 'Identificador de ação já usado em outra resposta.';
    end if;
    v_dup := true;
  else
    if v_s.status = 'encerrada' then
      raise exception 'resolve_session_closed' using errcode = 'P0001';
    elsif v_s.status = 'pausada' then
      raise exception 'resolve_session_paused' using errcode = 'P0001';
    end if;
    if v_s.deadline_at is not null and now() > v_s.deadline_at then
      raise exception 'resolve_deadline_passed' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.attempts a where a.session_item_id = p_session_item_id) then
      raise exception 'resolve_already_answered' using errcode = 'P0001';
    end if;
    select * into v_alt from public.alternatives al where al.id = p_alternative_id and al.item_version_id = v_si.item_version_id;
    if not found then
      raise exception 'resolve_alternative_invalid' using errcode = 'P0001';
    end if;
    select iv.item_id, iv.annulled into v_item, v_annulled from public.item_versions iv
     where iv.id = v_si.item_version_id and iv.review_status = 'published';
    if v_item is null then
      raise exception 'resolve_item_unavailable' using errcode = 'P0001';
    end if;
    if p_confidence is not null and p_confidence not between 1 and 3 then
      raise exception 'resolve_confidence_invalid' using errcode = 'P0001';
    end if;
    -- tempos do cliente: limitados ao tempo real desde o início da sessão (+1 min de folga)
    if (p_elapsed_ms is not null and (p_elapsed_ms < 0 or p_elapsed_ms > extract(epoch from (now() - v_s.started_at)) * 1000 + 60000))
       or (p_active_ms is not null and (p_active_ms < 0 or p_active_ms > coalesce(p_elapsed_ms, p_active_ms))) then
      raise exception 'resolve_time_invalid' using errcode = 'P0001', hint = 'Tempo maior que a sessão ou tempo ativo maior que o total.';
    end if;
    v_help := coalesce(p_help_seen, false) or exists (
      select 1 from public.attempt_events e where e.session_item_id = p_session_item_id and e.event_type = 'ajuda_vista');

    insert into public.attempts (user_id, session_item_id, item_version_id, item_id, chosen_alternative_id, is_correct,
                                 client_action_id, confidence, help_seen, is_repeat, active_ms, elapsed_ms)
    values (v_uid, p_session_item_id, v_si.item_version_id, v_item, p_alternative_id,
            case when v_annulled then null else v_alt.is_correct end,
            p_client_action_id, p_confidence, v_help,
            exists (select 1 from public.attempts a2 where a2.user_id = v_uid and a2.item_id = v_item),
            p_active_ms, p_elapsed_ms)
    returning * into v_att;

    -- Caderno de erros: um erro ativo por item; erro repetido atualiza a mesma entrada.
    if v_att.is_correct is false then
      insert into public.error_entries (user_id, item_id, first_attempt_id, latest_attempt_id)
      values (v_uid, v_item, v_att.id, v_att.id)
      on conflict (user_id, item_id) where resolved_at is null
      do update set latest_attempt_id = excluded.latest_attempt_id, wrong_count = public.error_entries.wrong_count + 1, updated_at = now();
    end if;

    -- Agenda de revisão (F3-T07), na mesma transação da resposta.
    perform private.apply_review(v_att.id, now());

    perform private.append_event(v_s.id, p_session_item_id, 'resposta_confirmada',
                                 jsonb_build_object('alternativa', v_alt.stable_key), null, 'srv:resposta:' || v_att.id);
  end if;

  select ee.id into v_err from public.error_entries ee where ee.user_id = v_uid and ee.item_id = v_att.item_id and ee.resolved_at is null;
  select al.id into v_correct from public.alternatives al where al.item_version_id = v_att.item_version_id and al.is_correct limit 1;
  return query select v_att.id, v_att.is_correct, v_correct, v_att.is_repeat, v_att.help_seen, v_dup, v_err;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.text_is_safe(text) to authenticated;
grant execute on function private.blocks_are_safe(jsonb) to authenticated;
grant execute on function private.json_strings_are_safe(jsonb) to authenticated;
grant execute on function private.proposal_is_complete(jsonb) to authenticated;
grant execute on function private.utf16_length(text) to authenticated;
grant execute on function private.booklet_for_payload(jsonb) to authenticated;
grant execute on function private.answer_for_payload(jsonb) to authenticated;
grant execute on function private.tag_review_problems(uuid, jsonb, jsonb) to authenticated;
grant execute on function private.publication_blockers(uuid) to authenticated;
