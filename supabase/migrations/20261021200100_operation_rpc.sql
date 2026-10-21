-- =============================================================================
-- Operativos (2/2): creating, joining, leaving and ending them; bringing my pending stops;
-- the day's operativos; and counting their visits in every member's day.
-- =============================================================================

-- A merchandiser's workday for a date: the existing one or a new one with this status.
create function private.ensure_workday(p_company uuid, p_person uuid, p_date date, p_status public.workday_status)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  wid uuid;
begin
  select id into wid from public.workday where company_id = p_company and merchandiser_id = p_person and work_date = p_date;
  if wid is not null then
    update public.workday set deleted_at = null where id = wid and deleted_at is not null;
    return wid;
  end if;
  insert into public.workday (company_id, merchandiser_id, work_date, status, created_by)
  values (p_company, p_person, p_date, p_status, coalesce(private.current_person_id(), p_person))
  returning id into wid;
  return wid;
end $$;

-- Who may join: active merchandisers of the company, in no other open operativo that day.
create function private.check_operation_people(p_company uuid, p_date date, p_people uuid[], p_except uuid default null)
returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from unnest(p_people) x
             where not exists (select 1 from public.membership m
                               where m.company_id = p_company and m.person_id = x and m.status = 'active' and 'merchandiser' = any (m.roles))) then
    raise exception 'Person is not an active merchandiser of this company' using errcode = '23514';
  end if;
  if exists (select 1 from public.operation o join public.operation_member m on m.operation_id = o.id
             where o.company_id = p_company and o.work_date = p_date and o.ended_at is null and m.left_at is null
               and m.person_id = any (p_people) and o.id is distinct from p_except) then
    raise exception 'Someone is already in an operativo that day' using errcode = '23505';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Creating: a merchandiser shares their own day (host = me), or a supervisor or admin
-- prepares one for someone (as a draft until it is published, like any assignment).
-- -----------------------------------------------------------------------------
create function public.create_operation(p_company uuid, p_date date, p_members uuid[], p_host uuid default null, p_name text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me       uuid := private.current_person_id();
  host     uuid := coalesce(p_host, private.current_person_id());
  boss     boolean;
  everyone uuid[];
  status   public.workday_status;
  wid      uuid;
  oid      uuid;
  p        uuid;
begin
  if me is null then raise exception 'Complete your identity first' using errcode = '42501'; end if;
  boss := p_company in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin'));
  if host <> me and not boss then
    raise exception 'Only supervisors and admins create an operativo for someone else' using errcode = '42501';
  end if;
  everyone := array(select distinct x from unnest(array_append(coalesce(p_members, '{}'), host)) x where x is not null);
  if cardinality(everyone) < 2 then raise exception 'An operativo needs at least two merchandisers' using errcode = '22023'; end if;
  if cardinality(everyone) > 12 then raise exception 'An operativo has up to 12 merchandisers' using errcode = '22023'; end if;
  perform private.check_operation_people(p_company, p_date, everyone);

  -- Out in the street they start now; a supervisor's plan waits to be published.
  status := case when host = me then 'published' else 'draft' end;
  wid := private.ensure_workday(p_company, host, p_date, status);
  insert into public.operation (company_id, workday_id, host_id, work_date, name, created_by)
  values (p_company, wid, host, p_date, nullif(btrim(p_name), ''), me)
  returning id into oid;
  foreach p in array everyone loop
    insert into public.operation_member (operation_id, company_id, person_id, workday_id, added_by)
    values (oid, p_company, p, case when p = host then wid else private.ensure_workday(p_company, p, p_date, status) end, me);
  end loop;
  return oid;
end $$;

-- Any member (or a supervisor or admin) adds someone; someone who left comes back.
create function public.add_operation_member(p_operation uuid, p_person uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  o  public.operation%rowtype;
  st public.workday_status;
begin
  select * into o from public.operation where id = p_operation;
  if not found or o.ended_at is not null then raise exception 'Operativo not found or ended' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.operation_member m where m.operation_id = o.id and m.person_id = me and m.left_at is null)
     and o.company_id not in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')) then
    raise exception 'Only members, supervisors and admins add people to an operativo' using errcode = '42501';
  end if;
  if (select count(*) from public.operation_member m where m.operation_id = o.id and m.left_at is null) >= 12 then
    raise exception 'An operativo has up to 12 merchandisers' using errcode = '22023';
  end if;
  perform private.check_operation_people(o.company_id, o.work_date, array[p_person], o.id);
  select status into st from public.workday where id = o.workday_id;
  insert into public.operation_member (operation_id, company_id, person_id, workday_id, added_by)
  values (o.id, o.company_id, p_person, private.ensure_workday(o.company_id, p_person, o.work_date, st), me)
  on conflict (operation_id, person_id) do update set left_at = null, added_by = excluded.added_by;
end $$;

-- A member leaves: what they did stays. The host ends the operativo instead.
create function public.leave_operation(p_operation uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  o  public.operation%rowtype;
begin
  select * into o from public.operation where id = p_operation;
  if not found then raise exception 'Operativo not found' using errcode = 'P0002'; end if;
  if o.host_id = me then raise exception 'The host ends the operativo' using errcode = '23514'; end if;
  update public.operation_member set left_at = now() where operation_id = o.id and person_id = me and left_at is null;
  if not found then raise exception 'Not a member of this operativo' using errcode = '42501'; end if;
end $$;

-- The host, its creator, a supervisor or an admin ends it: members are free for another one;
-- the stops stay in the host's day and what each one did stays counted.
create function public.end_operation(p_operation uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  o  public.operation%rowtype;
begin
  select * into o from public.operation where id = p_operation;
  if not found then raise exception 'Operativo not found' using errcode = 'P0002'; end if;
  if me not in (o.host_id, o.created_by)
     and o.company_id not in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')) then
    raise exception 'Only the host, a supervisor or an admin ends an operativo' using errcode = '42501';
  end if;
  update public.operation set ended_at = coalesce(ended_at, now()) where id = o.id;
end $$;

-- A member brings pending stops of their own day into the operativo (same store, task and
-- displays to arrange); they leave their day so nobody visits them twice. Returns how many.
create function public.bring_to_operation(p_operation uuid, p_visits uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  o  public.operation%rowtype;
  v  public.visit%rowtype;
  n  integer := 0;
begin
  select * into o from public.operation where id = p_operation;
  if not found or o.ended_at is not null then raise exception 'Operativo not found or ended' using errcode = 'P0002'; end if;
  if not private.works_operation(o.workday_id) then raise exception 'Not a member of this operativo' using errcode = '42501'; end if;
  for v in select * from public.visit where id = any (p_visits) and deleted_at is null loop
    if v.merchandiser_id <> me or v.work_status <> 'pending' or v.work_date <> o.work_date or v.workday_id = o.workday_id then
      raise exception 'Only my pending stops of that day can join the operativo' using errcode = '23514';
    end if;
    perform public.add_visit(o.workday_id, p_store => v.store_id, p_task => v.task,
      p_display_types => array(select d.display_type_id from public.display d where d.visit_id = v.id and d.deleted_at is null order by d.sort_order));
    -- Out of my day without the "assigned stops are removed by the supervisor" rule: it moves, it is not dropped.
    perform set_config('visitario.store_cleanup', 'on', true);
    update public.visit set deleted_at = now() where id = v.id;
    perform set_config('visitario.store_cleanup', 'off', true);
    n := n + 1;
  end loop;
  return n;
end $$;

-- -----------------------------------------------------------------------------
-- The day's operativos I can see, with members and progress (activador and supervisor).
-- -----------------------------------------------------------------------------
create function public.day_operations(p_company uuid, p_date date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.created_at), '[]'::jsonb)
  from (
    select o.created_at, jsonb_build_object(
      'id', o.id, 'workday_id', o.workday_id, 'host_id', o.host_id, 'name', o.name, 'created_by', o.created_by,
      'created_at', o.created_at, 'ended_at', o.ended_at, 'workday_status', w.status,
      'members', (select jsonb_agg(jsonb_build_object('person_id', m.person_id, 'first_name', p.first_name, 'last_name', p.last_name,
                                                      'left_at', m.left_at, 'workday_id', m.workday_id) order by m.joined_at)
                  from public.operation_member m join public.person p on p.id = m.person_id where m.operation_id = o.id),
      'total', (select count(*) from public.visit v where v.workday_id = o.workday_id and v.deleted_at is null),
      'visited', (select count(*) from public.visit v where v.workday_id = o.workday_id and v.deleted_at is null
                    and v.work_status in ('done', 'refused', 'closed')),
      'in_progress', (select count(*) from public.visit v where v.workday_id = o.workday_id and v.deleted_at is null and v.work_status = 'in_progress')
    ) as j
    from public.operation o join public.workday w on w.id = o.workday_id
    where o.company_id = p_company and o.work_date = p_date and w.deleted_at is null
      and o.id in (select private.visible_operations())
      and (w.status <> 'draft' or o.created_by = private.current_person_id()
           or o.company_id in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')))
  ) x;
$$;

revoke all on function private.ensure_workday, private.check_operation_people from public, anon, authenticated;
revoke all on function public.create_operation, public.add_operation_member, public.leave_operation, public.end_operation,
                       public.bring_to_operation, public.day_operations from public, anon;
grant execute on function public.create_operation, public.add_operation_member, public.leave_operation, public.end_operation,
                          public.bring_to_operation, public.day_operations to authenticated;

-- -----------------------------------------------------------------------------
-- What an operativo does counts in each member's day: progress and work totals per
-- person count the visits of the operativos they take part in (same columns as before).
-- -----------------------------------------------------------------------------
create or replace view public.daily_progress with (security_invoker = true) as
select v.company_id, v.work_date, p.person_id as merchandiser_id,
       count(*)                                                             as total,
       count(*) filter (where v.work_status in ('done', 'refused', 'closed')) as visited,
       count(*) filter (where v.work_status = 'done')                       as done,
       count(*) filter (where v.work_status = 'refused')                    as refused,
       count(*) filter (where v.work_status = 'closed')                     as closed,
       count(*) filter (where v.review_status = 'approved')                 as approved,
       count(*) filter (where v.review_status = 'needs_fix')                as needs_fix,
       count(*) filter (where v.source = 'added')                           as added,
       max(v.updated_at)                                                    as last_activity_at
from public.visit v
cross join lateral (
  select v.merchandiser_id as person_id
  union
  select m.person_id from public.operation o join public.operation_member m on m.operation_id = o.id where o.workday_id = v.workday_id
) p
where v.deleted_at is null
group by v.company_id, v.work_date, p.person_id;

create or replace view public.daily_metrics with (security_invoker = true) as
select v.company_id, v.work_date, p.person_id as merchandiser_id, mt.metric_id, sum(mt.quantity)::integer as quantity
from public.visit v
join public.visit_metric mt on mt.visit_id = v.id
cross join lateral (
  select v.merchandiser_id as person_id
  union
  select m.person_id from public.operation o join public.operation_member m on m.operation_id = o.id where o.workday_id = v.workday_id
) p
where v.deleted_at is null
group by v.company_id, v.work_date, p.person_id, mt.metric_id;

-- The team's day: each merchandiser's own visits plus those of their operativos.
-- Last activity is what that person did (events and photos by them).
create or replace function public.team_day(p_company uuid, p_date date)
returns table (
  person_id uuid, first_name text, last_name text,
  workday_id uuid, workday_status public.workday_status,
  total integer, visited integer, in_progress integer, refused integer, closed integer,
  approved integer, needs_fix integer, to_review integer,
  last_activity_at timestamptz, last_place text,
  sync_pending integer, sync_failed integer, sync_photos integer, sync_reported_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with scope as (
    select s.merchandiser_id from private.visible_merchandisers() s where s.company_id = p_company
  ),
  days as (
    select w.id, w.merchandiser_id, w.status from public.workday w
    join scope on scope.merchandiser_id = w.merchandiser_id
    where w.company_id = p_company and w.work_date = p_date and w.deleted_at is null
  ),
  part as (
    select d.merchandiser_id as person, v.id, v.store_id, v.work_status, v.review_status
    from days d join public.visit v on v.workday_id = d.id and v.deleted_at is null
    union all
    select m.person_id, v.id, v.store_id, v.work_status, v.review_status
    from public.operation o
    join public.operation_member m on m.operation_id = o.id and m.person_id <> o.host_id
    join scope on scope.merchandiser_id = m.person_id
    join public.workday w on w.id = o.workday_id and w.deleted_at is null
    join public.visit v on v.workday_id = o.workday_id and v.deleted_at is null
    where o.company_id = p_company and o.work_date = p_date
  ),
  activity as (
    select pt.person, pt.store_id, a.at
    from part pt
    join lateral (
      select max(e.occurred_at) as at from public.visit_event e where e.visit_id = pt.id and e.actor_id = pt.person
      union all
      select max(f.created_at) from public.photo f where f.visit_id = pt.id and f.created_by = pt.person
    ) a on a.at is not null
  ),
  last_act as (
    select distinct on (a.person) a.person, a.at, coalesce(st.name, st.address) as place
    from activity a join public.store st on st.id = a.store_id
    order by a.person, a.at desc
  )
  select p.id, p.first_name, p.last_name, d.id, d.status,
         count(v.id)::integer,
         count(v.id) filter (where v.work_status in ('done', 'refused', 'closed'))::integer,
         count(v.id) filter (where v.work_status = 'in_progress')::integer,
         count(v.id) filter (where v.work_status = 'refused')::integer,
         count(v.id) filter (where v.work_status = 'closed')::integer,
         count(v.id) filter (where v.review_status = 'approved')::integer,
         count(v.id) filter (where v.review_status = 'needs_fix')::integer,
         count(v.id) filter (where v.review_status = 'unreviewed' and v.work_status in ('done', 'refused', 'closed'))::integer,
         la.at, la.place,
         coalesce(sr.pending, 0), coalesce(sr.failed, 0), coalesce(sr.photos, 0), sr.reported_at
  from scope
  join public.person p on p.id = scope.merchandiser_id
  left join days d on d.merchandiser_id = p.id
  left join part v on v.person = p.id
  left join last_act la on la.person = p.id
  left join public.sync_report sr on sr.company_id = p_company and sr.person_id = p.id
  group by p.id, p.first_name, p.last_name, d.id, d.status, la.at, la.place, sr.pending, sr.failed, sr.photos, sr.reported_at
  order by p.first_name, p.last_name;
$$;

-- -----------------------------------------------------------------------------
-- Realtime: operativo changes arrive live; its private channel "operation:<id>" carries
-- who is where (presence, never stored) only for those who can see the operativo.
-- -----------------------------------------------------------------------------
create function private.topic_operation(p_topic text) returns uuid
language sql immutable set search_path = '' as $$
  select case when p_topic ~ '^operation:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then substr(p_topic, 11)::uuid end;
$$;
grant execute on function private.topic_operation to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.operation, public.operation_member;
  end if;
  if exists (select 1 from pg_namespace where nspname = 'realtime')
     and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'realtime' and p.proname = 'topic') then
    execute $p$create policy operation_channel_read on realtime.messages for select to authenticated
      using (private.topic_operation((select realtime.topic())) in (select private.visible_operations()))$p$;
    execute $p$create policy operation_channel_write on realtime.messages for insert to authenticated
      with check (private.topic_operation((select realtime.topic())) in (select private.visible_operations()))$p$;
  end if;
end $$;
