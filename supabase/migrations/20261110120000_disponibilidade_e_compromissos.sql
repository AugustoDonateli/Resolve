-- F4-T13 — Disponibilidade e compromissos. Critério do backlog: conflitos e fuso testados; alterar uma data
-- não apaga a regra semanal. Plano §4.4: availability_rules, fixed_commitments (user_id, weekday, start_time,
-- end_time, timezone, date_overrides) — horários recorrentes e exceções. §11: compromissos não podem ser
-- sobrepostos silenciosamente.
--
-- Regras:
--   * Regra semanal: dia da semana (0 = domingo), início e fim no mesmo dia, fuso próprio (padrão: o do perfil)
--     e validade (de/até). Dia da semana e fuso não mudam depois de criados: outra regra os substitui.
--   * Exceção de um dia (schedule_exceptions): cancelar ou mudar o horário de uma ocorrência, ou criar um
--     horário avulso. A regra semanal nunca é alterada por uma exceção.
--   * Ocorrências concretas são calculadas no fuso da regra e mostradas no fuso de quem vê (horário de verão
--     incluído). O conflito é conferido sobre as ocorrências do próximo ano, então vale entre fusos diferentes
--     e só em parte do ano.
--   * Compromisso não se sobrepõe a compromisso; horário livre não se sobrepõe a horário livre (o horário
--     livre efetivo é o horário livre menos os compromissos, calculado pela agenda F4-T15).
--   * Desfazer uma exceção (apagar) também é conferido: a ocorrência que volta não pode colidir.
-- Sem comandos destrutivos nesta migração (o conector pede confirmação e o pedido não chega ao app).

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time(0) not null check (date_part('second', start_time) = 0),
  end_time time(0) not null check (date_part('second', end_time) = 0),
  timezone text not null check (char_length(timezone) between 1 and 64),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (valid_until is null or valid_until >= valid_from)
);

create table public.fixed_commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80 and private.text_is_safe(title)),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time(0) not null check (date_part('second', start_time) = 0),
  end_time time(0) not null check (date_part('second', end_time) = 0),
  timezone text not null check (char_length(timezone) between 1 and 64),
  valid_from date not null,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (valid_until is null or valid_until >= valid_from)
);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('disponivel', 'compromisso')),
  action text not null check (action in ('cancelar', 'mover', 'avulso')),
  availability_rule_id uuid references public.availability_rules (id) on delete cascade,
  commitment_id uuid references public.fixed_commitments (id) on delete cascade,
  on_date date not null,
  start_time time(0) check (date_part('second', start_time) = 0),
  end_time time(0) check (date_part('second', end_time) = 0),
  timezone text not null check (char_length(timezone) between 1 and 64),
  title text check (char_length(trim(title)) between 1 and 80 and private.text_is_safe(title)),
  note text check (char_length(note) <= 200 and private.text_is_safe(note)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(availability_rule_id, commitment_id) <= 1),
  check ((action = 'avulso') = (availability_rule_id is null and commitment_id is null)),
  check (commitment_id is null or kind = 'compromisso'),
  check (availability_rule_id is null or kind = 'disponivel'),
  check ((action = 'cancelar') = (start_time is null and end_time is null)),
  check (start_time is null or end_time > start_time),
  check (action = 'avulso' or title is null),
  check (action <> 'avulso' or kind <> 'compromisso' or title is not null)
);
create unique index schedule_exceptions_one_per_occurrence
  on public.schedule_exceptions (coalesce(availability_rule_id, commitment_id), on_date) where action <> 'avulso';

-- Ocorrências concretas entre p_from e p_to (datas no fuso p_view_tz).
create function private.schedule_occurrences_for(p_user uuid, p_from date, p_to date, p_view_tz text)
returns table (kind text, source text, source_id uuid, rule_id uuid, title text, starts_at timestamptz, ends_at timestamptz,
               local_start timestamp, local_end timestamp, changed boolean)
language sql stable set search_path = '' as $$
  with win as (
    select (p_from::timestamp at time zone p_view_tz) as w0, ((p_to + 1)::timestamp at time zone p_view_tz) as w1
  ), days as (
    select g::date as d from generate_series((p_from - 1)::timestamp, (p_to + 1)::timestamp, interval '1 day') g
  ), rules as (
    select 'disponivel'::text as kind, r.id, null::text as title, r.weekday, r.start_time, r.end_time, r.timezone, r.valid_from, r.valid_until
    from public.availability_rules r where r.user_id = p_user
    union all
    select 'compromisso', c.id, c.title, c.weekday, c.start_time, c.end_time, c.timezone, c.valid_from, c.valid_until
    from public.fixed_commitments c where c.user_id = p_user
  ), occ as (
    select r.kind, 'regra'::text as source, r.id as source_id, r.id as rule_id, r.title,
           (dd.d + r.start_time) at time zone r.timezone as starts_at, (dd.d + r.end_time) at time zone r.timezone as ends_at, false as changed
    from rules r join days dd on extract(dow from dd.d) = r.weekday and dd.d >= r.valid_from and (r.valid_until is null or dd.d <= r.valid_until)
    where not exists (select 1 from public.schedule_exceptions e
                      where e.on_date = dd.d and e.action <> 'avulso' and coalesce(e.availability_rule_id, e.commitment_id) = r.id)
    union all
    select e.kind, 'excecao', e.id, r.id, coalesce(e.title, r.title),
           (e.on_date + e.start_time) at time zone e.timezone, (e.on_date + e.end_time) at time zone e.timezone, true
    from public.schedule_exceptions e
    left join rules r on r.id = coalesce(e.availability_rule_id, e.commitment_id)
    where e.user_id = p_user and e.action in ('mover', 'avulso') and e.on_date between p_from - 1 and p_to + 1
      and (e.action = 'avulso' or (r.id is not null and e.on_date >= r.valid_from and (r.valid_until is null or e.on_date <= r.valid_until)))
  )
  select o.kind, o.source, o.source_id, o.rule_id, o.title, o.starts_at, o.ends_at,
         o.starts_at at time zone p_view_tz, o.ends_at at time zone p_view_tz, o.changed
  from occ o, win
  where o.starts_at < win.w1 and o.ends_at > win.w0
  order by o.starts_at, o.kind, o.source_id;
$$;

-- Primeira ocorrência do mesmo tipo que colide com a origem indicada, no próximo ano. Nulo = sem conflito.
create function private.schedule_conflict(p_user uuid, p_kind text, p_source text, p_source_id uuid) returns text
language sql stable set search_path = '' as $$
  with tz as (
    select private.valid_tz((select p.timezone from public.profiles p where p.user_id = p_user)) as v
  ), occ as (
    select o.* from tz, private.schedule_occurrences_for(p_user, (now() at time zone tz.v)::date - 1, (now() at time zone tz.v)::date + 371, tz.v) o
    where o.kind = p_kind
  )
  select format('%s em %s, das %s às %s', coalesce(b.title, 'outro horário livre'), to_char(b.local_start, 'DD/MM/YYYY'),
                to_char(b.local_start, 'HH24:MI'), to_char(b.local_end, 'HH24:MI'))
  from occ a join occ b on a.starts_at < b.ends_at and b.starts_at < a.ends_at and not (a.source = b.source and a.source_id = b.source_id)
  where a.source = p_source and a.source_id = p_source_id
  order by b.starts_at
  limit 1;
$$;

create function private.schedule_today(p_user uuid, p_tz text) returns date
language sql stable set search_path = '' as $$
  select (now() at time zone coalesce(p_tz, private.valid_tz((select p.timezone from public.profiles p where p.user_id = p_user))))::date;
$$;

-- Antes de gravar uma regra: fuso válido (padrão do perfil), validade, campos fixos, trava por conta.
create function private.schedule_rule_before() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.weekday <> old.weekday or new.timezone <> old.timezone) then
    raise exception 'resolve_schedule_rule_fixed' using errcode = 'P0001',
      hint = 'Dia da semana e fuso não mudam: encerre esta regra e crie outra.';
  end if;
  new.timezone := coalesce(nullif(trim(new.timezone), ''),
                           private.valid_tz((select p.timezone from public.profiles p where p.user_id = new.user_id)));
  if private.valid_tz(new.timezone) <> new.timezone then
    raise exception 'resolve_timezone_invalid' using errcode = 'P0001', hint = 'Fuso horário desconhecido.';
  end if;
  new.valid_from := coalesce(new.valid_from, private.schedule_today(new.user_id, new.timezone));
  if new.valid_from > private.schedule_today(new.user_id, new.timezone) + 365 then
    raise exception 'resolve_schedule_too_far' using errcode = 'P0001', hint = 'A regra precisa começar no próximo ano.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('resolve:agenda:' || new.user_id::text, 0));
  new.updated_at := now();
  return new;
end;
$$;

-- Antes de gravar uma exceção: a ocorrência existe, é da mesma conta e o fuso é o da regra.
create function private.schedule_exception_before() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid; v_weekday smallint; v_tz text; v_from date; v_until date; v_today date;
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.kind <> old.kind or new.action <> old.action or new.on_date <> old.on_date
       or new.availability_rule_id is distinct from old.availability_rule_id or new.commitment_id is distinct from old.commitment_id) then
    raise exception 'resolve_schedule_exception_fixed' using errcode = 'P0001', hint = 'Desfaça a mudança e crie outra.';
  end if;
  if new.action <> 'avulso' then
    if new.availability_rule_id is not null then
      select r.user_id, r.weekday, r.timezone, r.valid_from, r.valid_until into v_owner, v_weekday, v_tz, v_from, v_until
      from public.availability_rules r where r.id = new.availability_rule_id;
      new.kind := 'disponivel';
    else
      select c.user_id, c.weekday, c.timezone, c.valid_from, c.valid_until into v_owner, v_weekday, v_tz, v_from, v_until
      from public.fixed_commitments c where c.id = new.commitment_id;
      new.kind := 'compromisso';
    end if;
    if v_owner is distinct from new.user_id then
      raise exception 'resolve_schedule_rule_not_found' using errcode = 'P0001';
    end if;
    if extract(dow from new.on_date) <> v_weekday or new.on_date < v_from or (v_until is not null and new.on_date > v_until) then
      raise exception 'resolve_schedule_not_an_occurrence' using errcode = 'P0001', hint = 'A regra não acontece nesse dia.';
    end if;
    new.timezone := v_tz;
  else
    new.timezone := coalesce(nullif(trim(new.timezone), ''),
                             private.valid_tz((select p.timezone from public.profiles p where p.user_id = new.user_id)));
    if private.valid_tz(new.timezone) <> new.timezone then
      raise exception 'resolve_timezone_invalid' using errcode = 'P0001', hint = 'Fuso horário desconhecido.';
    end if;
  end if;
  v_today := private.schedule_today(new.user_id, new.timezone);
  if new.on_date < v_today - 1 or new.on_date > v_today + 365 then
    raise exception 'resolve_schedule_date_out_of_range' using errcode = 'P0001', hint = 'Mude datas de hoje até um ano à frente.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('resolve:agenda:' || new.user_id::text, 0));
  new.updated_at := now();
  return new;
end;
$$;

-- Depois de gravar: nenhuma ocorrência do mesmo tipo pode colidir.
create function private.schedule_check_after() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text; v_source text := 'regra'; v_id uuid := new.id; v_msg text;
begin
  if tg_table_name = 'availability_rules' then
    v_kind := 'disponivel';
  elsif tg_table_name = 'fixed_commitments' then
    v_kind := 'compromisso';
  else
    if new.action = 'cancelar' then
      return null;
    end if;
    v_kind := new.kind; v_source := 'excecao';
  end if;
  v_msg := private.schedule_conflict(new.user_id, v_kind, v_source, v_id);
  if v_msg is not null then
    raise exception 'resolve_schedule_conflict' using errcode = 'P0001',
      hint = case v_kind when 'compromisso' then 'Colide com o compromisso ' else 'Já há horário livre: ' end || v_msg || '.';
  end if;
  return null;
end;
$$;

-- Desfazer um cancelamento ou uma mudança devolve a ocorrência da regra: ela também não pode colidir.
create function private.schedule_exception_undo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_rule uuid := coalesce(old.availability_rule_id, old.commitment_id); v_msg text;
begin
  if old.action = 'avulso' or v_rule is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('resolve:agenda:' || old.user_id::text, 0));
  v_msg := private.schedule_conflict(old.user_id, old.kind, 'regra', v_rule);
  if v_msg is not null then
    raise exception 'resolve_schedule_conflict' using errcode = 'P0001',
      hint = 'Ao desfazer, o horário colidiria com ' || v_msg || '.';
  end if;
  return null;
end;
$$;

create trigger availability_rules_before before insert or update on public.availability_rules
  for each row execute function private.schedule_rule_before();
create trigger fixed_commitments_before before insert or update on public.fixed_commitments
  for each row execute function private.schedule_rule_before();
create trigger schedule_exceptions_before before insert or update on public.schedule_exceptions
  for each row execute function private.schedule_exception_before();
create trigger availability_rules_check after insert or update on public.availability_rules
  for each row execute function private.schedule_check_after();
create trigger fixed_commitments_check after insert or update on public.fixed_commitments
  for each row execute function private.schedule_check_after();
create trigger schedule_exceptions_check after insert or update on public.schedule_exceptions
  for each row execute function private.schedule_check_after();
create trigger schedule_exceptions_undo after delete on public.schedule_exceptions
  for each row execute function private.schedule_exception_undo();

-- Ocorrências da conta do login, no fuso do perfil. Até 62 dias por consulta.
create function public.schedule_occurrences(p_from date, p_to date)
returns table (kind text, source text, source_id uuid, rule_id uuid, title text, starts_at timestamptz, ends_at timestamptz,
               local_start timestamp, local_end timestamp, changed boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'resolve_schedule_range' using errcode = 'P0001', hint = 'Consulte de 1 a 63 dias.';
  end if;
  return query select * from private.schedule_occurrences_for(auth.uid(), p_from, p_to,
    private.valid_tz((select p.timezone from public.profiles p where p.user_id = auth.uid())));
end;
$$;

alter table public.availability_rules enable row level security;
alter table public.fixed_commitments enable row level security;
alter table public.schedule_exceptions enable row level security;
revoke all on public.availability_rules, public.fixed_commitments, public.schedule_exceptions from anon, authenticated;
grant select, insert, update, delete on public.availability_rules, public.fixed_commitments, public.schedule_exceptions to authenticated;
create policy "horários livres: os próprios" on public.availability_rules for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "compromissos: os próprios" on public.fixed_commitments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "exceções da agenda: as próprias" on public.schedule_exceptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create index availability_rules_user on public.availability_rules (user_id, weekday);
create index fixed_commitments_user on public.fixed_commitments (user_id, weekday);
create index schedule_exceptions_user_date on public.schedule_exceptions (user_id, on_date);
create index schedule_exceptions_availability on public.schedule_exceptions (availability_rule_id);
create index schedule_exceptions_commitment on public.schedule_exceptions (commitment_id);

revoke all on function private.schedule_occurrences_for(uuid, date, date, text), private.schedule_conflict(uuid, text, text, uuid),
  private.schedule_today(uuid, text), private.schedule_rule_before(), private.schedule_exception_before(),
  private.schedule_check_after(), private.schedule_exception_undo() from public, anon, authenticated;
revoke all on function public.schedule_occurrences(date, date) from public, anon;
grant execute on function public.schedule_occurrences(date, date) to authenticated;
