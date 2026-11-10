-- F4-T04 — Triagem de 20 segundos. Critério: três decisões possíveis; interrupção não altera indevidamente a
-- duração. Plano T12 e §"Medidas": decisões "agora", "depois" e "chuto"; 20 s por decisão, com escolha de
-- continuar lendo sem avançar à força. O tempo gravado é o tempo VISÍVEL medido pelo app (página oculta
-- não conta), limitado a 10 min; a janela é registrada como encerrada quando a decisão veio depois de 20 s.
create table public.triage_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_item_id uuid not null unique references public.session_items (id) on delete cascade,
  client_action_id uuid not null,
  decision text not null check (decision in ('agora', 'depois', 'chuto')),
  visible_ms integer not null check (visible_ms between 0 and 600000),
  window_ms integer not null default 20000 check (window_ms > 0),
  window_closed boolean not null,
  decided_at timestamptz not null default now(),
  unique (user_id, client_action_id)
);
create index triage_decisions_user on public.triage_decisions (user_id, decided_at);

create function public.record_triage(p_client_action_id uuid, p_session_item_id uuid, p_decision text, p_visible_ms integer)
returns table (decision text, visible_ms integer, window_closed boolean, duplicate boolean)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare d public.triage_decisions%rowtype; v_started timestamptz;
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  select * into d from public.triage_decisions t where t.user_id = auth.uid() and t.client_action_id = p_client_action_id;
  if found then
    if d.session_item_id <> p_session_item_id or d.decision <> p_decision then
      raise exception 'resolve_action_reused' using errcode = 'P0001';
    end if;
    return query select d.decision, d.visible_ms, d.window_closed, true;
    return;
  end if;
  select s.started_at into v_started from public.session_items si join public.study_sessions s on s.id = si.session_id
   where si.id = p_session_item_id and s.user_id = auth.uid() and s.status <> 'encerrada';
  if not found then
    raise exception 'resolve_session_item_not_found' using errcode = 'P0001';
  end if;
  if p_decision not in ('agora', 'depois', 'chuto') then
    raise exception 'resolve_triage_decision_invalid' using errcode = 'P0001';
  end if;
  -- tempo visível não pode passar do tempo real desde o início da sessão (+1 min de folga de relógio)
  if p_visible_ms is null or p_visible_ms < 0 or p_visible_ms > least(600000, extract(epoch from (now() - v_started)) * 1000 + 60000) then
    raise exception 'resolve_time_invalid' using errcode = 'P0001';
  end if;
  insert into public.triage_decisions (user_id, session_item_id, client_action_id, decision, visible_ms, window_closed)
  values (auth.uid(), p_session_item_id, p_client_action_id, p_decision, p_visible_ms, p_visible_ms >= 20000)
  on conflict (session_item_id) do nothing
  returning * into d;
  if d.id is null then
    raise exception 'resolve_already_decided' using errcode = 'P0001';
  end if;
  return query select d.decision, d.visible_ms, d.window_closed, false;
end;
$$;

alter table public.triage_decisions enable row level security;
revoke all on public.triage_decisions from anon, authenticated;
grant select on public.triage_decisions to authenticated;
create policy "triagem: as próprias" on public.triage_decisions for select to authenticated using (user_id = (select auth.uid()));
revoke all on function public.record_triage(uuid, uuid, text, integer) from public, anon;
grant execute on function public.record_triage(uuid, uuid, text, integer) to authenticated;
