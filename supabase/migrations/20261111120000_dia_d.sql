-- O cartão do Dia D tem rascunho e transcrição independentes. As tabelas
-- são privadas para que o gabarito congelado só saia depois do encerramento.
create table private.dia_d_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_id uuid not null,
  booklet_id uuid not null references public.booklets(id),
  profile_id uuid not null references public.exam_profiles(id),
  language text check (language in ('ingles', 'espanhol')),
  prompt_id uuid references public.essay_prompts(id),
  reference_time boolean not null,
  essay text not null default '' check (char_length(essay) <= 30000),
  started_at timestamptz not null,
  deadline_at timestamptz not null check (deadline_at > started_at),
  ended_at timestamptz,
  position smallint not null,
  revision integer not null default 0,
  unique (user_id, action_id)
);

create unique index dia_d_one_open on private.dia_d_runs(user_id) where ended_at is null;

create table private.dia_d_items (
  run_id uuid not null references private.dia_d_runs(id) on delete cascade,
  position smallint not null,
  item_version_id uuid references public.item_versions(id),
  letters jsonb,
  annulled boolean not null,
  correct text,
  work text check (work in ('A','B','C','D','E')),
  card text check (card in ('A','B','C','D','E')),
  primary key (run_id, position),
  check ((item_version_id is null) = (letters is null)),
  check (annulled or (item_version_id is not null and correct is not null))
);

create table private.dia_d_events (
  run_id uuid not null references private.dia_d_runs(id) on delete cascade,
  sequence integer not null,
  action_id uuid not null,
  kind text not null check (kind in ('abriu', 'marcou', 'transcreveu', 'redacao', 'entregou')),
  position smallint,
  letter text,
  recorded_at timestamptz not null,
  primary key (run_id, sequence),
  unique (run_id, action_id)
);

-- Edital Inep 52/2025, §9.4. Horário só se aplica à versão e à aplicação conferidas.
create table private.dia_d_schedules (
  profile_id uuid primary key references public.exam_profiles(id),
  local_start time not null,
  timezone text not null,
  source_url text not null
);
insert into private.dia_d_schedules
select id, time '13:30', 'America/Sao_Paulo', 'https://download.inep.gov.br/enem/edital_52_de_23_de_maio_de_2025.pdf'
from public.exam_profiles where label = 'Enem 2025 · aplicação regular (referência)';

-- Expande as posições previstas pelo perfil. Um item só entra na contagem
-- se pertencer à seção correta e tiver as cinco letras do caderno mapeadas.
create function private.dia_d_booklets(p_booklet uuid default null)
returns table (
  booklet_id uuid, profile_id uuid, profile_label text, year smallint, day smallint,
  booklet_number smallint, color text, language text, minutes integer, essay boolean,
  prompt_id uuid, expected integer, available integer, annulled integer, slots jsonb,
  local_start time, timezone text, schedule_source text
)
language sql stable set search_path = '' as $$
  select b.id, ep.id, ep.label, a.year, b.day, b.booklet_number, b.color, lang.name,
         (rule->>'duration_minutes')::int, (rule->>'essay')::boolean, prompt.id,
         count(*)::int, count(mapped.letters) filter (where not slot.annulled)::int,
         count(*) filter (where slot.annulled)::int,
         jsonb_agg(jsonb_build_object('position', pos.n,
           'version', case when mapped.letters is not null then iv.id end,
           'letters', mapped.letters, 'annulled', slot.annulled,
           'correct', case when not slot.annulled then mapped.correct end) order by pos.n),
         sched.local_start, sched.timezone, sched.source_url
  from public.booklets b
  join public.applications a on a.id = b.application_id
  join public.exam_profiles ep on ep.id = a.profile_id
  left join private.dia_d_schedules sched on sched.profile_id = ep.id and a.type = 'regular'
  cross join lateral jsonb_array_elements(ep.day_rules_json->'days') as r(rule)
  cross join lateral (
    select distinct jsonb_array_elements_text(section->'foreign_language'->'options') as name
    from jsonb_array_elements(rule->'items') as s(section)
    union all
    select null where not exists (
      select 1 from jsonb_array_elements(rule->'items') as s(section)
      where section ? 'foreign_language'
    )
  ) lang
  cross join lateral jsonb_array_elements(rule->'items') as s(section)
  cross join lateral generate_series((section->>'from')::int, (section->>'to')::int) as pos(n)
  left join public.booklet_items bi on bi.booklet_id = b.id and bi.position = pos.n
    and bi.foreign_language is not distinct from
      case when pos.n between (section->'foreign_language'->>'from')::int
                       and (section->'foreign_language'->>'to')::int then lang.name end
  left join public.areas area on area.matrix_version_id = ep.matrix_version_id and area.code = section->>'area'
  left join public.item_versions iv on iv.id = bi.item_version_id and iv.review_status = 'published'
    and iv.area_id = area.id
  cross join lateral (
    -- Anulada pelo gabarito oficial do próprio caderno (official_answer_keys), a mesma fonte da publicação.
    select coalesce(iv.annulled, false) or exists (
      select 1 from public.official_answer_keys k
      where k.booklet_id = b.id and k.question_number = pos.n and k.answer = 'ANULADO'
        and k.foreign_language is not distinct from
          case when pos.n between (section->'foreign_language'->>'from')::int
                           and (section->'foreign_language'->>'to')::int then lang.name end
    ) as annulled
  ) slot
  left join lateral (
    select jsonb_object_agg(m.printed_letter, alt.stable_key) as letters,
           max(m.printed_letter) filter (where alt.is_correct and not iv.annulled) as correct
    from public.booklet_alternative_maps m
    join public.alternatives alt on alt.id = m.alternative_id and alt.item_version_id = iv.id
    where m.booklet_item_id = bi.id
    having count(*) = 5 and (slot.annulled or count(*) filter (where alt.is_correct) = 1)
  ) mapped on true
  left join lateral (
    select p.id
    from public.essay_prompts p
    join public.booklets src on src.source_id = p.source_id
      and src.application_id = b.application_id and src.day = b.day
    where (rule->>'essay')::boolean and p.origin = 'oficial' and p.status = 'published'
    order by p.published_at desc, p.id
    limit 1
  ) prompt on true
  where ep.status in ('reference', 'active') and b.variant = 'padrao'
    and b.day = (rule->>'day')::int and (p_booklet is null or b.id = p_booklet)
  group by b.id, ep.id, a.year, lang.name, rule, prompt.id, sched.profile_id
  having count(*) = count(distinct pos.n)
$$;

create function public.dia_d_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'server_time', statement_timestamp(),
    'booklets', coalesce((
      select jsonb_agg(to_jsonb(b) - 'slots' order by b.year desc, b.day, b.booklet_number, b.language)
      from private.dia_d_booklets() b
    ), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.started_at desc)
      from (
        select r.id, a.year, b.day, b.color, r.started_at, r.deadline_at, r.ended_at
        from private.dia_d_runs r
        join public.booklets b on b.id = r.booklet_id
        join public.applications a on a.id = b.application_id
        where r.user_id = auth.uid()
        order by r.ended_at is null desc, r.started_at desc limit 20
      ) h
    ), '[]'::jsonb)
  )
$$;

create function public.dia_d_start(p_booklet uuid, p_language text, p_action uuid, p_reference boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  current_id uuid;
  book record;
  started timestamptz;
  reference_start timestamptz;
begin
  if uid is null or p_action is null or p_booklet is null or p_reference is null then
    raise exception 'dia_d_not_allowed';
  end if;
  -- Serializa largadas da mesma conta, inclusive em duas abas.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select id into current_id from private.dia_d_runs where user_id = uid and action_id = p_action;
  if found then return current_id; end if;
  update private.dia_d_runs set ended_at = deadline_at
    where user_id = uid and ended_at is null and deadline_at <= clock_timestamp();
  select id into current_id from private.dia_d_runs where user_id = uid and ended_at is null;
  if found then return current_id; end if;
  select * into book from private.dia_d_booklets(p_booklet) b where b.language is not distinct from p_language;
  if not found or book.expected <> 90 or book.available + book.annulled <> book.expected
     or book.minutes not between 1 and 600 or book.minutes is null
     or (book.essay and book.prompt_id is null) then
    raise exception 'dia_d_booklet_unavailable';
  end if;
  started := clock_timestamp();
  if p_reference then
    if book.local_start is null then raise exception 'dia_d_schedule_unavailable'; end if;
    reference_start := (((started at time zone book.timezone)::date + book.local_start) at time zone book.timezone);
    if started < reference_start or started >= reference_start + interval '1 minute' then
      raise exception 'dia_d_schedule_unavailable';
    end if;
  end if;
  insert into private.dia_d_runs
    (user_id, action_id, booklet_id, profile_id, language, prompt_id, reference_time, started_at, deadline_at, position)
    values (uid, p_action, p_booklet, book.profile_id, book.language, book.prompt_id, p_reference, started,
            coalesce(reference_start, started) + make_interval(mins => book.minutes), (book.slots->0->>'position')::smallint)
    returning id into current_id;
  insert into private.dia_d_items(run_id, position, item_version_id, letters, annulled, correct)
    select current_id, (s->>'position')::smallint, (s->>'version')::uuid,
           nullif(s->'letters', 'null'::jsonb), (s->>'annulled')::boolean, s->>'correct'
    from jsonb_array_elements(book.slots) s;
  return current_id;
end
$$;

create function public.dia_d_save(
  p_run uuid, p_action uuid, p_revision integer, p_kind text,
  p_position smallint, p_letter text, p_essay text
) returns text language plpgsql security definer set search_path = '' as $$
declare
  run private.dia_d_runs%rowtype;
  saved_at timestamptz;
begin
  select * into run from private.dia_d_runs where id = p_run and user_id = auth.uid() for update;
  if not found then raise exception 'dia_d_not_allowed'; end if;
  if exists (select 1 from private.dia_d_events where run_id = p_run and action_id = p_action) then
    return 'saved';
  end if;
  saved_at := clock_timestamp();
  if run.ended_at is not null then return 'closed'; end if;
  if saved_at >= run.deadline_at then
    update private.dia_d_runs set ended_at = deadline_at where id = p_run;
    return 'closed';
  end if;
  if p_revision is distinct from run.revision then return 'conflict'; end if;
  if p_action is null or p_kind is null or p_kind not in ('abriu', 'marcou', 'transcreveu', 'redacao', 'entregou')
    or (p_letter is not null and p_letter not in ('A','B','C','D','E'))
    or (p_kind in ('abriu','marcou','transcreveu') and not exists (
      select 1 from private.dia_d_items where run_id = p_run and position = p_position
    ))
    or (p_kind = 'redacao' and (run.prompt_id is null or p_essay is null or char_length(p_essay) > 30000)) then
    raise exception 'dia_d_invalid_action';
  end if;
  if p_kind = 'marcou' then
    update private.dia_d_items set work = p_letter where run_id = p_run and position = p_position;
  elsif p_kind = 'transcreveu' then
    update private.dia_d_items set card = p_letter where run_id = p_run and position = p_position;
  end if;
  update private.dia_d_runs set revision = revision + 1,
    position = case when p_kind = 'abriu' then p_position else position end,
    essay = case when p_kind = 'redacao' then p_essay else essay end,
    ended_at = case when p_kind = 'entregou' then saved_at end
    where id = p_run;
  insert into private.dia_d_events
    values (p_run, run.revision + 1, p_action, p_kind,
      case when p_kind in ('abriu','marcou','transcreveu') then p_position end,
      case when p_kind in ('marcou','transcreveu') then p_letter end, saved_at);
  return 'saved';
end
$$;

create function public.dia_d_read(p_run uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  run private.dia_d_runs%rowtype;
  server_time timestamptz;
begin
  select * into run from private.dia_d_runs where id = p_run and user_id = auth.uid() for update;
  if not found then return null; end if;
  server_time := clock_timestamp();
  if run.ended_at is null and server_time >= run.deadline_at then
    update private.dia_d_runs set ended_at = deadline_at where id = p_run returning * into run;
  end if;
  return jsonb_build_object(
    'id', run.id, 'position', run.position, 'revision', run.revision, 'server_time', server_time,
    'started_at', run.started_at, 'deadline_at', run.deadline_at, 'ended_at', run.ended_at,
    'essay', run.essay, 'prompt_id', run.prompt_id, 'reference_time', run.reference_time,
    'booklet', (select jsonb_build_object('day', b.day, 'number', b.booklet_number,
      'color', b.color, 'profile', p.label, 'source', s.url)
      from public.booklets b join public.exam_profiles p on p.id = run.profile_id
      join public.sources s on s.id = b.source_id where b.id = run.booklet_id),
    'items', (select jsonb_agg(jsonb_build_object('position', i.position, 'version', i.item_version_id,
      'letters', i.letters, 'annulled', i.annulled, 'work', i.work, 'card', i.card)
      || case when run.ended_at is null then '{}'::jsonb else jsonb_build_object('correct', i.correct) end
      order by i.position) from private.dia_d_items i where i.run_id = run.id),
    'events', case when run.ended_at is not null then coalesce((
      select jsonb_agg(to_jsonb(e) - 'action_id' - 'run_id' order by e.sequence)
      from private.dia_d_events e where e.run_id = run.id
    ), '[]'::jsonb) else '[]'::jsonb end
  );
end
$$;

revoke all on private.dia_d_runs, private.dia_d_items, private.dia_d_events, private.dia_d_schedules from public, anon, authenticated;
revoke all on function private.dia_d_booklets(uuid) from public, anon, authenticated;
revoke all on function public.dia_d_catalog(), public.dia_d_start(uuid, text, uuid, boolean),
  public.dia_d_save(uuid, uuid, integer, text, smallint, text, text), public.dia_d_read(uuid) from public, anon;
grant execute on function public.dia_d_catalog(), public.dia_d_start(uuid, text, uuid, boolean),
  public.dia_d_save(uuid, uuid, integer, text, smallint, text, text), public.dia_d_read(uuid) to authenticated;
