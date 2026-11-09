-- F3-T01 (sessões e tentativas), F3-T06 (caderno de erros e motivo) e F3-T12 (eventos de sessão).
-- Plano §3 (regras 1–3) e §4.3. Tudo pela própria conta, só por funções:
--   - a confirmação da resposta é uma transação: tentativa + caderno de erros + evento;
--   - `client_action_id` torna o reenvio idempotente (uma tentativa lógica por ação);
--   - o acerto é calculado no servidor (o cliente nunca informa se acertou);
--   - o gabarito só sai depois da resposta;
--   - ver ajuda antes de responder marca a tentativa;
--   - prazo de prova é do servidor; tempos do cliente são limitados ao tempo real da sessão;
--   - eventos são discretos, com sequência por sessão e conteúdo restrito (nenhum texto livre).

-- ── Motivos de erro (taxonomia v0, decisão 0006) ──────────────────────────────
create function private.error_reason_ok(r text) returns boolean
language sql immutable set search_path = '' as $$
  select r in ('not_reported', 'leitura_do_comando', 'interpretacao', 'conteudo', 'calculo', 'distrator', 'tempo', 'chute');
$$;

-- ── Sessões ───────────────────────────────────────────────────────────────────
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_action_id uuid not null,
  mode text not null check (mode in ('treino', 'diagnostico', 'revisao', 'foco', 'simulado')),
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'encerrada')),
  profile_id uuid references public.exam_profiles (id),
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  ended_at timestamptz,
  planned_minutes smallint check (planned_minutes between 1 and 600),
  last_sequence integer not null default 0,
  unique (user_id, client_action_id),
  check ((status = 'encerrada') = (ended_at is not null)),
  check (deadline_at is null or deadline_at > started_at),
  check (mode <> 'simulado' or deadline_at is not null)
);

-- Lista congelada: ordem e versões fixas ao iniciar.
create table public.session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  item_version_id uuid not null references public.item_versions (id),
  booklet_item_id uuid references public.booklet_items (id),
  position smallint not null check (position between 1 and 200),
  selection_reason text not null default 'escolha' check (selection_reason in ('escolha', 'revisao', 'diagnostico', 'plano')),
  exposure_group_id uuid,
  unique (session_id, position),
  unique (session_id, item_version_id),
  unique (id, item_version_id)
);

-- ── Tentativas ────────────────────────────────────────────────────────────────
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_item_id uuid not null,
  item_version_id uuid not null,
  item_id uuid not null references public.items (id),
  chosen_alternative_id uuid not null,
  is_correct boolean,
  client_action_id uuid not null,
  submitted_at timestamptz not null default now(),
  confidence smallint check (confidence between 1 and 3),
  help_seen boolean not null default false,
  is_repeat boolean not null default false,
  active_ms integer check (active_ms between 0 and 86400000),
  elapsed_ms integer check (elapsed_ms between 0 and 86400000),
  unique (user_id, client_action_id),
  unique (session_item_id),
  check (active_ms is null or elapsed_ms is null or active_ms <= elapsed_ms),
  foreign key (session_item_id, item_version_id) references public.session_items (id, item_version_id) on delete cascade,
  foreign key (chosen_alternative_id, item_version_id) references public.alternatives (id, item_version_id)
);

-- ── Caderno de erros (F3-T06) ─────────────────────────────────────────────────
create table public.error_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id),
  first_attempt_id uuid not null references public.attempts (id) on delete cascade,
  latest_attempt_id uuid not null references public.attempts (id) on delete cascade,
  wrong_count integer not null default 1 check (wrong_count >= 1),
  reason text not null default 'not_reported' check (private.error_reason_ok(reason)),
  reason_set_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Um erro ativo por usuário e item.
create unique index error_entries_active on public.error_entries (user_id, item_id) where resolved_at is null;

-- ── Eventos de sessão (F3-T12) ────────────────────────────────────────────────
create function private.event_payload_ok(t text, p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'object' and case
    when t in ('alternativa_marcada', 'alternativa_desmarcada', 'resposta_confirmada') then
      (select coalesce(bool_and(k = 'alternativa'), true) from jsonb_object_keys(p) k) and p ? 'alternativa' and (p->>'alternativa') ~ '^[A-E]$'
    when t = 'questao_aberta' then
      (select coalesce(bool_and(k = 'origem'), true) from jsonb_object_keys(p) k)
      and (not p ? 'origem' or p->>'origem' in ('inicio', 'proxima', 'anterior', 'lista', 'retorno'))
    when t = 'motivo_informado' then
      (select coalesce(bool_and(k = 'motivo'), true) from jsonb_object_keys(p) k) and private.error_reason_ok(p->>'motivo')
    else p = '{}'::jsonb
  end;
$$;

create table public.attempt_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  session_item_id uuid references public.session_items (id) on delete cascade,
  event_type text not null check (event_type in (
    'sessao_iniciada', 'sessao_pausada', 'sessao_retomada', 'sessao_encerrada',
    'questao_aberta', 'questao_saida', 'alternativa_marcada', 'alternativa_desmarcada',
    'ajuda_vista', 'resposta_confirmada', 'marcada_para_revisar', 'desmarcada_para_revisar',
    'motivo_informado', 'pagina_oculta', 'pagina_visivel')),
  client_at timestamptz,
  server_at timestamptz not null default now(),
  sequence integer not null check (sequence >= 1),
  client_event_id text not null check (client_event_id ~ '^[A-Za-z0-9:_-]{1,80}$'),
  payload jsonb not null default '{}'::jsonb,
  check (private.event_payload_ok(event_type, payload)),
  unique (session_id, sequence),
  unique (session_id, client_event_id)
);

-- Acrescenta um evento com a próxima sequência da sessão (trava a sessão: ordem única e reproduzível).
create function private.append_event(p_session uuid, p_item uuid, p_type text, p_payload jsonb, p_client_at timestamptz, p_client_event_id text)
returns integer
language plpgsql set search_path = '' as $$
declare
  v_seq integer; v_user uuid; v_started timestamptz;
begin
  if exists (select 1 from public.attempt_events where session_id = p_session and client_event_id = p_client_event_id) then
    return null; -- reenvio: já registrado
  end if;
  update public.study_sessions set last_sequence = last_sequence + 1 where id = p_session
  returning last_sequence, user_id, started_at into v_seq, v_user, v_started;
  insert into public.attempt_events (user_id, session_id, session_item_id, event_type, client_at, sequence, client_event_id, payload)
  values (v_user, p_session, p_item, p_type,
          -- hora do cliente só quando plausível (entre o início da sessão e agora + 5 min)
          case when p_client_at between v_started - interval '1 minute' and now() + interval '5 minutes' then p_client_at end,
          v_seq, p_client_event_id, coalesce(p_payload, '{}'::jsonb));
  return v_seq;
end;
$$;

-- ── Funções públicas (a identidade vem sempre da sessão de login) ──────────────

-- Inicia uma sessão com a lista congelada de itens publicados. Reenvio da mesma ação devolve a mesma sessão.
create function public.start_session(p_client_action_id uuid, p_mode text, p_item_version_ids uuid[],
                                     p_planned_minutes integer default null, p_time_limit_minutes integer default null,
                                     p_selection_reason text default 'escolha')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_id uuid; v_n int; i int; v_iv uuid;
begin
  if v_uid is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  select id into v_id from public.study_sessions where user_id = v_uid and client_action_id = p_client_action_id;
  if v_id is not null then
    return v_id;
  end if;
  v_n := coalesce(cardinality(p_item_version_ids), 0);
  if v_n < 1 or v_n > 180 or (select count(distinct x) from unnest(p_item_version_ids) x) <> v_n then
    raise exception 'resolve_session_items_invalid' using errcode = 'P0001', hint = 'De 1 a 180 itens, sem repetição.';
  end if;
  if exists (select 1 from unnest(p_item_version_ids) x
             where not exists (select 1 from public.item_versions iv where iv.id = x and iv.review_status = 'published')) then
    raise exception 'resolve_item_unavailable' using errcode = 'P0001', hint = 'Só itens publicados entram em sessão.';
  end if;
  if p_mode = 'simulado' and (p_time_limit_minutes is null or p_time_limit_minutes not between 1 and 600) then
    raise exception 'resolve_deadline_required' using errcode = 'P0001', hint = 'Simulado exige prazo.';
  end if;
  insert into public.study_sessions (user_id, client_action_id, mode, planned_minutes, deadline_at)
  values (v_uid, p_client_action_id, p_mode, p_planned_minutes,
          case when p_time_limit_minutes between 1 and 600 then now() + make_interval(mins => p_time_limit_minutes) end)
  on conflict (user_id, client_action_id) do nothing
  returning id into v_id;
  if v_id is null then -- corrida com o mesmo reenvio
    select id into v_id from public.study_sessions where user_id = v_uid and client_action_id = p_client_action_id;
    return v_id;
  end if;
  for i in 1 .. v_n loop
    v_iv := p_item_version_ids[i];
    insert into public.session_items (session_id, item_version_id, booklet_item_id, position, selection_reason, exposure_group_id)
    select v_id, v_iv,
           (select bi.id from public.booklet_items bi join public.booklets b on b.id = bi.booklet_id
             where bi.item_version_id = v_iv order by b.day, b.booklet_number limit 1),
           i, p_selection_reason, iv.stimulus_version_id
    from public.item_versions iv where iv.id = v_iv;
  end loop;
  perform private.append_event(v_id, null, 'sessao_iniciada', '{}'::jsonb, null, 'srv:inicio');
  return v_id;
end;
$$;

-- Pausa (só treino, revisão e foco), retoma ou encerra. Idempotente.
create function public.set_session_status(p_session_id uuid, p_status text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_s public.study_sessions%rowtype;
begin
  select * into v_s from public.study_sessions where id = p_session_id and user_id = v_uid for update;
  if not found then
    raise exception 'resolve_session_not_found' using errcode = 'P0001';
  end if;
  if v_s.status = p_status then
    return v_s.status;
  end if;
  if v_s.status = 'encerrada' then
    raise exception 'resolve_session_closed' using errcode = 'P0001';
  end if;
  if p_status = 'pausada' then
    if v_s.mode not in ('treino', 'revisao', 'foco') then
      raise exception 'resolve_pause_not_allowed' using errcode = 'P0001', hint = 'Prova realista não pausa o prazo.';
    end if;
    update public.study_sessions set status = 'pausada' where id = p_session_id;
    perform private.append_event(p_session_id, null, 'sessao_pausada', '{}'::jsonb, null, 'srv:pausa:' || (v_s.last_sequence + 1));
  elsif p_status = 'ativa' then
    update public.study_sessions set status = 'ativa' where id = p_session_id;
    perform private.append_event(p_session_id, null, 'sessao_retomada', '{}'::jsonb, null, 'srv:retomada:' || (v_s.last_sequence + 1));
  elsif p_status = 'encerrada' then
    update public.study_sessions set status = 'encerrada', ended_at = now() where id = p_session_id;
    perform private.append_event(p_session_id, null, 'sessao_encerrada', '{}'::jsonb, null, 'srv:fim');
  else
    raise exception 'resolve_session_status_invalid' using errcode = 'P0001';
  end if;
  return p_status;
end;
$$;

-- Confirma a resposta. Uma tentativa lógica por ação; o acerto é do servidor; gabarito só depois.
create function public.submit_attempt(p_client_action_id uuid, p_session_item_id uuid, p_alternative_id uuid,
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

    perform private.append_event(v_s.id, p_session_item_id, 'resposta_confirmada',
                                 jsonb_build_object('alternativa', v_alt.stable_key), null, 'srv:resposta:' || v_att.id);
  end if;

  select ee.id into v_err from public.error_entries ee where ee.user_id = v_uid and ee.item_id = v_att.item_id and ee.resolved_at is null;
  select al.id into v_correct from public.alternatives al where al.item_version_id = v_att.item_version_id and al.is_correct limit 1;
  return query select v_att.id, v_att.is_correct, v_correct, v_att.is_repeat, v_att.help_seen, v_dup, v_err;
end;
$$;

-- Eventos do cliente (lote de até 100). Reenvio do mesmo `client_event_id` é ignorado; a sequência
-- segue a ordem do lote. Tipos que só o servidor gera (resposta, início, fim, motivo) são recusados.
create function public.log_session_events(p_session_id uuid, p_events jsonb)
returns table (logged integer, ignored integer, last_sequence integer)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid(); v_s public.study_sessions%rowtype; e jsonb; v_item uuid; v_seq integer;
  n_logged int := 0; n_ignored int := 0;
begin
  select * into v_s from public.study_sessions where id = p_session_id and user_id = v_uid for update;
  if not found then
    raise exception 'resolve_session_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'resolve_events_invalid' using errcode = 'P0001', hint = 'Envie de 0 a 100 eventos por vez.';
  end if;
  for e in select * from jsonb_array_elements(p_events) loop
    if (e->>'type') not in ('questao_aberta', 'questao_saida', 'alternativa_marcada', 'alternativa_desmarcada', 'ajuda_vista',
                            'marcada_para_revisar', 'desmarcada_para_revisar', 'pagina_oculta', 'pagina_visivel') then
      raise exception 'resolve_event_type_invalid' using errcode = 'P0001', hint = coalesce(e->>'type', '(sem tipo)');
    end if;
    v_item := null;
    if e ? 'session_item_id' and e->>'session_item_id' is not null then
      select si.id into v_item from public.session_items si where si.id = (e->>'session_item_id')::uuid and si.session_id = p_session_id;
      if v_item is null then
        raise exception 'resolve_event_item_invalid' using errcode = 'P0001';
      end if;
    end if;
    v_seq := private.append_event(p_session_id, v_item, e->>'type', coalesce(e->'payload', '{}'::jsonb),
                                  case when (e->>'client_at') is not null then (e->>'client_at')::timestamptz end,
                                  'cli:' || (e->>'client_event_id'));
    if v_seq is null then n_ignored := n_ignored + 1; else n_logged := n_logged + 1; end if;
  end loop;
  return query select n_logged, n_ignored, (select s.last_sequence from public.study_sessions s where s.id = p_session_id);
end;
$$;

-- Motivo do erro: opcional, um clique; voltar a "não informado" também é possível.
create function public.set_error_reason(p_entry_id uuid, p_reason text)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); v_e public.error_entries%rowtype; v_session uuid; v_item uuid;
begin
  select * into v_e from public.error_entries where id = p_entry_id and user_id = v_uid for update;
  if not found then
    raise exception 'resolve_error_entry_not_found' using errcode = 'P0001';
  end if;
  if not private.error_reason_ok(p_reason) then
    raise exception 'resolve_error_reason_invalid' using errcode = 'P0001';
  end if;
  if v_e.reason = p_reason then
    return p_reason;
  end if;
  update public.error_entries set reason = p_reason, reason_set_at = case when p_reason = 'not_reported' then null else now() end, updated_at = now()
   where id = p_entry_id;
  select si.session_id, a.session_item_id into v_session, v_item
    from public.attempts a join public.session_items si on si.id = a.session_item_id where a.id = v_e.latest_attempt_id;
  perform private.append_event(v_session, v_item, 'motivo_informado', jsonb_build_object('motivo', p_reason), null,
                               'srv:motivo:' || p_entry_id || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'));
  return p_reason;
end;
$$;

-- ── Acesso: leitura só do que é da própria conta; escrita só pelas funções acima ──
alter table public.study_sessions enable row level security;
alter table public.session_items enable row level security;
alter table public.attempts enable row level security;
alter table public.error_entries enable row level security;
alter table public.attempt_events enable row level security;
revoke all on public.study_sessions, public.session_items, public.attempts, public.error_entries, public.attempt_events from anon, authenticated;
grant select on public.study_sessions, public.session_items, public.attempts, public.error_entries, public.attempt_events to authenticated;
create policy "sessões: as próprias" on public.study_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy "itens da sessão: das próprias sessões" on public.session_items for select to authenticated
  using (exists (select 1 from public.study_sessions s where s.id = session_items.session_id and s.user_id = (select auth.uid())));
create policy "tentativas: as próprias" on public.attempts for select to authenticated using (user_id = (select auth.uid()));
create policy "caderno: o próprio" on public.error_entries for select to authenticated using (user_id = (select auth.uid()));
create policy "eventos: os próprios" on public.attempt_events for select to authenticated using (user_id = (select auth.uid()));

revoke all on function public.start_session(uuid, text, uuid[], integer, integer, text) from public, anon;
revoke all on function public.set_session_status(uuid, text) from public, anon;
revoke all on function public.submit_attempt(uuid, uuid, uuid, integer, boolean, integer, integer) from public, anon;
revoke all on function public.log_session_events(uuid, jsonb) from public, anon;
revoke all on function public.set_error_reason(uuid, text) from public, anon;
grant execute on function public.start_session(uuid, text, uuid[], integer, integer, text) to authenticated;
grant execute on function public.set_session_status(uuid, text) to authenticated;
grant execute on function public.submit_attempt(uuid, uuid, uuid, integer, boolean, integer, integer) to authenticated;
grant execute on function public.log_session_events(uuid, jsonb) to authenticated;
grant execute on function public.set_error_reason(uuid, text) to authenticated;

-- Índices para as chaves estrangeiras e consultas da própria conta.
create index study_sessions_user on public.study_sessions (user_id, started_at desc);
create index study_sessions_profile on public.study_sessions (profile_id);
create index session_items_version on public.session_items (item_version_id);
create index session_items_booklet_item on public.session_items (booklet_item_id);
create index attempts_user_item on public.attempts (user_id, item_id);
create index attempts_item_version on public.attempts (item_version_id);
create index attempts_alternative on public.attempts (chosen_alternative_id, item_version_id);
create index attempts_item on public.attempts (item_id);
create index error_entries_user on public.error_entries (user_id, created_at desc);
create index error_entries_item on public.error_entries (item_id);
create index error_entries_first on public.error_entries (first_attempt_id);
create index error_entries_latest on public.error_entries (latest_attempt_id);
create index attempt_events_user on public.attempt_events (user_id);
create index attempt_events_item on public.attempt_events (session_item_id);

-- CHECKs de eventos e caderno usam funções puras de private com os privilégios de quem escreve
-- (aqui, as funções definidoras); nada novo exposto. Mantém as concessões anteriores.
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
