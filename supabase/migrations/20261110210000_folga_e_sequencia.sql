-- F4-T18 — Folga e sequência. Critério: folga planejada preserva sequência conforme regra; histórico não é
-- apagado. Plano §4.4: rest_days (user_id, date, reason). Regra da plataforma "sequencia-v1":
--   * dia ativo = resposta de questão, revisão de cartão, bloco de estudo concluído ou rascunho de redação salvo;
--   * folga = marcada para hoje ou para frente (nunca para trás); até 2 por semana (segunda a domingo);
--   * a sequência conta dias ativos consecutivos até hoje; folga não quebra nem soma; dia vazio quebra;
--     hoje ainda sem atividade não quebra (o dia não terminou).
-- Folga passada não sai (histórico); só folga futura pode ser desmarcada.
create table public.rest_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rest_date date not null,
  reason text check (char_length(reason) <= 120 and private.text_is_safe(reason)),
  created_at timestamptz not null default now(),
  primary key (user_id, rest_date)
);

create function private.guard_rest_day() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_today date; v_row public.rest_days%rowtype;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  v_today := private.schedule_today(v_row.user_id, null);
  if tg_op = 'DELETE' then
    if old.rest_date <= v_today then
      raise exception 'resolve_rest_day_history' using errcode = 'P0001', hint = 'Folga de hoje ou de dias passados fica no histórico.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    raise exception 'resolve_rest_day_fixed' using errcode = 'P0001';
  end if;
  if new.rest_date < v_today then
    raise exception 'resolve_rest_day_past' using errcode = 'P0001', hint = 'Folga é planejada: hoje ou para frente.';
  end if;
  if new.rest_date > v_today + 60 then
    raise exception 'resolve_rest_day_far' using errcode = 'P0001';
  end if;
  if (select count(*) from public.rest_days r where r.user_id = new.user_id
        and date_trunc('week', r.rest_date) = date_trunc('week', new.rest_date)) >= 2 then
    raise exception 'resolve_rest_day_limit' using errcode = 'P0001', hint = 'Até 2 folgas por semana (segunda a domingo).';
  end if;
  return new;
end;
$$;
create trigger rest_days_guard before insert or update or delete on public.rest_days
  for each row execute function private.guard_rest_day();

-- Dias ativos e folgas dos últimos p_days dias até p_today (datas no fuso do perfil).
create function private.activity_days(p_user uuid, p_today date, p_days integer)
returns table (day date, active boolean, rest boolean)
language sql stable set search_path = '' as $$
  with tz as (select private.valid_tz((select p.timezone from public.profiles p where p.user_id = p_user)) as v),
  days as (select (p_today - g)::date as day from generate_series(0, greatest(p_days, 1) - 1) g),
  act as (
    select (a.submitted_at at time zone tz.v)::date as day from public.attempts a, tz where a.user_id = p_user
    union select (c.applied_at at time zone tz.v)::date from public.card_reviews c, tz where c.user_id = p_user
    union select b.local_date from public.study_blocks b where b.user_id = p_user and b.status = 'concluido'
    union select (v.updated_at at time zone tz.v)::date from public.essay_versions v join public.essays e on e.id = v.essay_id, tz
      where e.user_id = p_user and char_length(v.plain_text) > 0
  )
  select d.day, exists (select 1 from act where act.day = d.day),
         exists (select 1 from public.rest_days r where r.user_id = p_user and r.rest_date = d.day)
  from days d order by d.day desc;
$$;

create function private.streak_for(p_user uuid, p_today date)
returns integer language plpgsql stable set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select * from private.activity_days(p_user, p_today, 400) loop
    if r.active then n := n + 1;
    elsif r.rest or r.day = p_today then continue;
    else exit;
    end if;
  end loop;
  return n;
end;
$$;

create function public.streak_status()
returns table (streak integer, rule_version text, today date, rest_this_week integer, last_days jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare v_today date;
begin
  if auth.uid() is null then
    raise exception 'resolve_not_signed_in' using errcode = 'P0001';
  end if;
  v_today := private.schedule_today(auth.uid(), null);
  return query select private.streak_for(auth.uid(), v_today), 'sequencia-v1'::text, v_today,
    (select count(*)::integer from public.rest_days r where r.user_id = auth.uid() and date_trunc('week', r.rest_date) = date_trunc('week', v_today)),
    (select jsonb_agg(jsonb_build_object('day', d.day, 'active', d.active, 'rest', d.rest) order by d.day)
       from private.activity_days(auth.uid(), v_today, 14) d);
end;
$$;

alter table public.rest_days enable row level security;
revoke all on public.rest_days from anon, authenticated;
grant select, insert, delete on public.rest_days to authenticated;
create policy "folgas: as próprias" on public.rest_days for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on function private.guard_rest_day(), private.activity_days(uuid, date, integer), private.streak_for(uuid, date) from public, anon, authenticated;
revoke all on function public.streak_status() from public, anon;
grant execute on function public.streak_status() to authenticated;
