-- F3-T09 — Cartões revisados. Critério do backlog: cartão com fonte/revisão entra na fila e nunca na TRI.
-- Plano §4.3: concept_cards (subject_id, front, back, source_ids, review_status), "fórmulas e conceitos
-- revisados; separados de questões oficiais e fora da TRI".
--
-- Regras:
--   * Um cartão só é publicado com fonte (documento em sources e localização) e revisão de um editor. Depois
--     de publicado não muda; só é aposentado.
--   * Errar uma questão cuja habilidade aprovada tem cartão publicado põe o cartão na fila do aluno. O aluno
--     também pode pôr um cartão na fila manualmente.
--   * A revisão do cartão é gravada em card_reviews, nunca em attempts. A TRI e as estatísticas de questão
--     leem só attempts.
--   * Agenda: mesma versão srs-v1 (1/3/7/14/30). "Não lembrei" reinicia; antes do vencimento não conta.
--   * A fila do dia junta questões e cartões, mais atrasados primeiro, com o mesmo tempo por entrada.

-- Limpeza do teste de concorrência da F5-T08 (política temporária da conta de teste A e reservas já
-- liberadas). Não afeta nenhum outro ambiente.
delete from public.ai_reservations r using public.ai_budgets b, public.ai_budget_policies p
 where b.id = r.user_budget_id and p.id = b.policy_id and p.source_note like 'teste de concorrência F5-T08%' and r.status = 'liberada';
delete from public.ai_budget_policies where source_note like 'teste de concorrência F5-T08%';

create table public.concept_cards (
  id uuid primary key default gen_random_uuid(),
  area_code text not null check (area_code in ('LC', 'MT', 'CN', 'CH', 'RED')),
  kind text not null default 'conceito' check (kind in ('conceito', 'formula')),
  skill_id uuid references public.skills (id),
  subject_id uuid references public.subjects (id),
  front text not null check (char_length(front) between 3 and 600 and private.text_is_safe(front)),
  back text not null check (char_length(back) between 1 and 2000 and private.text_is_safe(back)),
  source_id uuid not null references public.sources (id),
  source_locator text not null check (char_length(source_locator) between 1 and 200 and private.text_is_safe(source_locator)),
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado', 'aposentado')),
  created_by uuid default auth.uid() references auth.users (id),
  reviewed_by uuid references auth.users (id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'rascunho') = (published_at is null)),
  check (status = 'rascunho' or reviewed_by is not null)
);

create function private.guard_concept_card() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'rascunho' then
      raise exception 'resolve_card_published_immutable' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' and new.status <> 'rascunho' then
    raise exception 'resolve_card_publish_invalid' using errcode = 'P0001', hint = 'Crie como rascunho, revise e publique.';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'rascunho' then
    if old.status = 'publicado' and new.status = 'aposentado'
       and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'resolve_card_published_immutable' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and new.status = 'publicado' then
    new.reviewed_by := auth.uid(); -- revisão registrada com a conta de quem publica
    new.published_at := now();
    if new.reviewed_by is null then
      raise exception 'resolve_card_reviewer_required' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger concept_cards_guard before insert or update or delete on public.concept_cards
  for each row execute function private.guard_concept_card();

create table public.card_review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.concept_cards (id),
  scheduler_version text not null references public.review_schedulers (version),
  stage smallint not null default 0 check (stage >= 0),
  status text not null default 'ativa' check (status in ('ativa', 'concluida')),
  due_date date not null,
  timezone text not null,
  origin text not null check (origin in ('erro', 'manual')),
  error_entry_id uuid references public.error_entries (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((status = 'concluida') = (completed_at is not null))
);
create unique index card_review_items_active on public.card_review_items (user_id, card_id) where status = 'ativa';

create table public.card_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_review_item_id uuid not null references public.card_review_items (id) on delete cascade,
  client_action_id uuid not null,
  recalled boolean not null,
  outcome text not null check (outcome in ('lembrou', 'nao_lembrou', 'antecipada', 'concluida')),
  stage_before smallint not null,
  stage_after smallint not null,
  due_before date,
  due_after date,
  local_date date not null,
  timezone text not null,
  scheduler_version text not null references public.review_schedulers (version),
  applied_at timestamptz not null,
  unique (user_id, client_action_id)
);

-- Põe o cartão na fila do aluno (vence no dia local seguinte). Já ativo → nada muda.
create function private.enqueue_card(p_user uuid, p_card uuid, p_origin text, p_error uuid, p_now timestamptz) returns uuid
language plpgsql set search_path = '' as $$
declare
  s public.review_schedulers%rowtype; v_tz text; v_id uuid;
begin
  if not exists (select 1 from public.concept_cards c where c.id = p_card and c.status = 'publicado') then
    raise exception 'resolve_card_unavailable' using errcode = 'P0001';
  end if;
  select * into s from public.review_schedulers where version = 'srs-v1';
  v_tz := private.valid_tz((select p.timezone from public.profiles p where p.user_id = p_user));
  insert into public.card_review_items (user_id, card_id, scheduler_version, due_date, timezone, origin, error_entry_id, created_at, updated_at)
  values (p_user, p_card, s.version, (p_now at time zone v_tz)::date + s.intervals_days[1], v_tz, p_origin, p_error, p_now, p_now)
  on conflict (user_id, card_id) where status = 'ativa' do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.card_review_items where user_id = p_user and card_id = p_card and status = 'ativa';
  end if;
  return v_id;
end;
$$;

-- Erro novo no caderno: cartões publicados da habilidade aprovada da questão entram na fila.
create function private.enqueue_cards_for_error() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_card uuid;
begin
  for v_card in
    select distinct c.id from public.concept_cards c
    join public.item_skill_tags t on t.skill_id = c.skill_id and t.review_status = 'aprovada'
    join public.item_versions iv on iv.id = t.item_version_id and iv.review_status = 'published'
    where iv.item_id = new.item_id and c.status = 'publicado'
  loop
    perform private.enqueue_card(new.user_id, v_card, 'erro', new.id, now());
  end loop;
  return new;
end;
$$;
create trigger error_entries_enqueue_cards after insert on public.error_entries
  for each row execute function private.enqueue_cards_for_error();

-- Aplica a revisão de um cartão. Uma revisão lógica por ação (reenvio devolve a mesma).
create function private.apply_card_review(p_user uuid, p_client_action_id uuid, p_card uuid, p_recalled boolean, p_now timestamptz)
returns table (outcome text, stage smallint, due_date date, duplicate boolean)
language plpgsql set search_path = '' as $$
#variable_conflict use_column
declare
  rv public.card_reviews%rowtype; ri public.card_review_items%rowtype; s public.review_schedulers%rowtype;
  v_tz text; v_local date; v_due date; v_stage int; v_out text; v_n int;
begin
  select * into rv from public.card_reviews cr where cr.user_id = p_user and cr.client_action_id = p_client_action_id;
  if found then
    if rv.card_review_item_id not in (select x.id from public.card_review_items x where x.card_id = p_card and x.user_id = p_user)
       or rv.recalled <> p_recalled then
      raise exception 'resolve_action_reused' using errcode = 'P0001';
    end if;
    return query select rv.outcome, rv.stage_after, rv.due_after, true;
    return;
  end if;
  select * into ri from public.card_review_items x where x.user_id = p_user and x.card_id = p_card and x.status = 'ativa' for update;
  if not found then
    raise exception 'resolve_card_not_in_review' using errcode = 'P0001';
  end if;
  select * into s from public.review_schedulers where version = ri.scheduler_version;
  v_n := cardinality(s.intervals_days);
  v_tz := private.valid_tz((select p.timezone from public.profiles p where p.user_id = p_user));
  v_local := (p_now at time zone v_tz)::date;
  v_stage := ri.stage;
  if v_local < ri.due_date then
    v_out := 'antecipada'; v_due := ri.due_date;
  elsif not p_recalled then
    v_out := 'nao_lembrou'; v_stage := 0; v_due := v_local + s.intervals_days[1];
  elsif v_stage + 1 >= v_n then
    v_out := 'concluida'; v_stage := v_stage + 1; v_due := null;
  else
    v_out := 'lembrou'; v_stage := v_stage + 1; v_due := v_local + s.intervals_days[v_stage + 1];
  end if;
  insert into public.card_reviews (user_id, card_review_item_id, client_action_id, recalled, outcome, stage_before, stage_after,
                                   due_before, due_after, local_date, timezone, scheduler_version, applied_at)
  values (p_user, ri.id, p_client_action_id, p_recalled, v_out, ri.stage, v_stage, ri.due_date, v_due, v_local, v_tz, s.version, p_now);
  if v_out = 'concluida' then
    update public.card_review_items set stage = v_stage, status = 'concluida', completed_at = p_now, updated_at = p_now where id = ri.id;
  elsif v_out <> 'antecipada' then
    update public.card_review_items set stage = v_stage, due_date = v_due, timezone = v_tz, updated_at = p_now where id = ri.id;
  end if;
  return query select v_out, v_stage::smallint, v_due, false;
end;
$$;

create function public.review_card(p_client_action_id uuid, p_card_id uuid, p_recalled boolean)
returns table (outcome text, stage smallint, due_date date, duplicate boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  return query select * from private.apply_card_review(auth.uid(), p_client_action_id, p_card_id, p_recalled, now());
end;
$$;

create function public.add_card_to_review(p_card_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  return private.enqueue_card(auth.uid(), p_card_id, 'manual', null, now());
end;
$$;

-- Fila do dia com questões e cartões (substitui a da F3-T07, agora com o tipo de cada entrada).
drop function public.review_queue(integer);
drop function private.review_queue_for(uuid, timestamptz, integer);
create function private.review_queue_for(p_user uuid, p_now timestamptz, p_available_minutes integer)
returns table (kind text, review_item_id uuid, item_id uuid, item_version_id uuid, card_id uuid, due_date date, days_overdue integer,
               stage smallint, queue_position integer, in_batch boolean, local_date date, minutes_per_item smallint)
language sql stable set search_path = '' as $$
  with cfg as (
    select s.minutes_per_item, (p_now at time zone private.valid_tz((select p.timezone from public.profiles p where p.user_id = p_user)))::date as today
    from public.review_schedulers s where s.version = 'srs-v1'
  ), entries as (
    select 'questao'::text as kind, ri.id, ri.item_id, null::uuid as card_id, ri.due_date, ri.stage, ri.created_at
    from public.review_items ri, cfg where ri.user_id = p_user and ri.status = 'ativa' and ri.due_date <= cfg.today
    union all
    select 'cartao', ci.id, null, ci.card_id, ci.due_date, ci.stage, ci.created_at
    from public.card_review_items ci join public.concept_cards c on c.id = ci.card_id and c.status = 'publicado', cfg
    where ci.user_id = p_user and ci.status = 'ativa' and ci.due_date <= cfg.today
  ), due as (
    select e.*, (select iv.id from public.item_versions iv where e.item_id is not null and iv.item_id = e.item_id and iv.review_status = 'published'
                 order by iv.version desc limit 1) as iv_id,
           row_number() over (order by e.due_date, e.stage, e.created_at, e.id) as pos
    from entries e
  )
  select d.kind, d.id, d.item_id, d.iv_id, d.card_id, d.due_date, (cfg.today - d.due_date)::integer, d.stage, d.pos::integer,
         d.pos <= greatest(0, coalesce(p_available_minutes, 0)) / cfg.minutes_per_item, cfg.today, cfg.minutes_per_item
  from due d, cfg
  order by d.pos;
$$;
create function public.review_queue(p_available_minutes integer default 30)
returns table (kind text, review_item_id uuid, item_id uuid, item_version_id uuid, card_id uuid, due_date date, days_overdue integer,
               stage smallint, queue_position integer, in_batch boolean, local_date date, minutes_per_item smallint)
language sql stable security definer set search_path = '' as $$
  select * from private.review_queue_for(auth.uid(), now(), p_available_minutes) where auth.uid() is not null;
$$;

alter table public.concept_cards enable row level security;
alter table public.card_review_items enable row level security;
alter table public.card_reviews enable row level security;
revoke all on public.concept_cards, public.card_review_items, public.card_reviews from anon, authenticated;
grant select, insert, update, delete on public.concept_cards to authenticated;
grant select on public.card_review_items, public.card_reviews to authenticated;
create policy "cartões: publicados ou editor" on public.concept_cards for select to authenticated
  using (status = 'publicado' or (select public.is_editor()));
create policy "cartões: editor cria" on public.concept_cards for insert to authenticated with check ((select public.is_editor()));
create policy "cartões: editor altera" on public.concept_cards for update to authenticated using ((select public.is_editor())) with check ((select public.is_editor()));
create policy "cartões: editor remove rascunho" on public.concept_cards for delete to authenticated using ((select public.is_editor()));
create policy "cartões na revisão: os próprios" on public.card_review_items for select to authenticated using (user_id = (select auth.uid()));
create policy "revisões de cartão: as próprias" on public.card_reviews for select to authenticated using (user_id = (select auth.uid()));

create index concept_cards_skill on public.concept_cards (skill_id) where status = 'publicado';
create index concept_cards_subject on public.concept_cards (subject_id);
create index concept_cards_source on public.concept_cards (source_id);
create index concept_cards_created_by on public.concept_cards (created_by);
create index concept_cards_reviewed_by on public.concept_cards (reviewed_by);
create index card_review_items_user_due on public.card_review_items (user_id, due_date) where status = 'ativa';
create index card_review_items_card on public.card_review_items (card_id);
create index card_review_items_error on public.card_review_items (error_entry_id);
create index card_review_items_scheduler on public.card_review_items (scheduler_version);
create index card_reviews_item on public.card_reviews (card_review_item_id);
create index card_reviews_scheduler on public.card_reviews (scheduler_version);

revoke all on function private.guard_concept_card(), private.enqueue_card(uuid, uuid, text, uuid, timestamptz),
  private.enqueue_cards_for_error(), private.apply_card_review(uuid, uuid, uuid, boolean, timestamptz),
  private.review_queue_for(uuid, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.review_card(uuid, uuid, boolean), public.add_card_to_review(uuid), public.review_queue(integer) from public, anon;
grant execute on function public.review_card(uuid, uuid, boolean), public.add_card_to_review(uuid), public.review_queue(integer) to authenticated;
