-- =============================================================================
-- Stage 3 · Supervisor: the team's day, review and corrections, assigning workdays,
-- and each phone's sync state so the supervisor sees who has work not sent yet.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sync state reported by each phone (counts only; the work itself syncs as usual).
-- -----------------------------------------------------------------------------
create table public.sync_report (
  company_id   uuid not null references public.company (id) on delete cascade,
  person_id    uuid not null references public.person (id) on delete cascade,
  pending      integer not null default 0 check (pending >= 0),
  failed       integer not null default 0 check (failed >= 0),
  photos       integer not null default 0 check (photos >= 0),
  oldest_at    timestamptz,
  reported_at  timestamptz not null default now(),
  primary key (company_id, person_id)
);
alter table public.sync_report enable row level security;
create policy sync_report_select on public.sync_report for select to authenticated
  using ((company_id, person_id) in (select * from private.visible_merchandisers()));
grant select on public.sync_report to authenticated;

-- The phone reports for its own person only; the time is the server's.
create function public.report_sync(p_company uuid, p_pending integer, p_failed integer, p_photos integer, p_oldest timestamptz default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
begin
  if me is null or not exists (select 1 from public.membership m
                               where m.company_id = p_company and m.person_id = me
                                 and m.status = 'active' and 'merchandiser' = any (m.roles)) then
    return; -- nothing to report for a company where I do not work
  end if;
  insert into public.sync_report (company_id, person_id, pending, failed, photos, oldest_at, reported_at)
  values (p_company, me, greatest(p_pending, 0), greatest(p_failed, 0), greatest(p_photos, 0), p_oldest, now())
  on conflict (company_id, person_id) do update
    set pending = excluded.pending, failed = excluded.failed, photos = excluded.photos,
        oldest_at = excluded.oldest_at, reported_at = now();
end $$;

-- -----------------------------------------------------------------------------
-- The team's day: one row per merchandiser in my scope (team for a supervisor,
-- everyone for an admin), with progress, review counts, last activity and sync.
-- Last activity counts only what the merchandiser did (not reviews).
-- -----------------------------------------------------------------------------
create function public.team_day(p_company uuid, p_date date)
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
  visits as (
    select v.* from public.visit v join days d on d.id = v.workday_id where v.deleted_at is null
  ),
  activity as (
    select v.merchandiser_id, v.store_id, a.at
    from visits v
    join lateral (
      select max(e.occurred_at) as at from public.visit_event e where e.visit_id = v.id and e.actor_id = v.merchandiser_id
      union all
      select max(f.created_at) from public.photo f where f.visit_id = v.id
    ) a on a.at is not null
  ),
  last_act as (
    select distinct on (a.merchandiser_id) a.merchandiser_id, a.at, coalesce(st.name, st.address) as place
    from activity a join public.store st on st.id = a.store_id
    order by a.merchandiser_id, a.at desc
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
  left join visits v on v.workday_id = d.id
  left join last_act la on la.merchandiser_id = p.id
  left join public.sync_report sr on sr.company_id = p_company and sr.person_id = p.id
  group by p.id, p.first_name, p.last_name, d.id, d.status, la.at, la.place, sr.pending, sr.failed, sr.photos, sr.reported_at
  order by p.first_name, p.last_name;
$$;

-- -----------------------------------------------------------------------------
-- Review: asking for a fix always carries the comment (one transaction).
-- Approving is a plain update of review_status (visit_guard checks who may).
-- -----------------------------------------------------------------------------
create function public.request_fix(p_visit uuid, p_body text, p_display uuid default null)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v public.visit%rowtype;
begin
  if nullif(btrim(p_body), '') is null then
    raise exception 'Requesting a fix needs a comment' using errcode = '23514';
  end if;
  select * into v from public.visit where id = p_visit;
  if not found then raise exception 'Visit not found' using errcode = 'P0002'; end if;
  insert into public.comment (company_id, visit_id, display_id, author_id, kind, body)
  values (v.company_id, v.id, p_display, private.current_person_id(), 'fix_request', btrim(p_body));
  update public.visit set review_status = 'needs_fix' where id = v.id;
end $$;

-- -----------------------------------------------------------------------------
-- Assigning: the supervisor's draft for a merchandiser and date (or the existing
-- workday, published or not). Visits are added with add_visit as usual.
-- -----------------------------------------------------------------------------
create function public.plan_workday(p_company uuid, p_merchandiser uuid, p_date date)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  wid uuid;
begin
  select id into wid from public.workday
  where company_id = p_company and merchandiser_id = p_merchandiser and work_date = p_date;
  if wid is not null then
    update public.workday set deleted_at = null where id = wid and deleted_at is not null;
    return wid;
  end if;
  insert into public.workday (company_id, merchandiser_id, work_date, status, created_by)
  values (p_company, p_merchandiser, p_date, 'draft', private.current_person_id())
  returning id into wid;
  return wid;
end $$;

-- Copies the stops of a workday into another one (store, task and indicated displays),
-- skipping stores the target already has. Returns how many were added.
create function public.copy_workday(p_from uuid, p_to uuid)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  r record;
  added integer := 0;
begin
  for r in
    select v.store_id, v.task,
           coalesce(array_agg(d.display_type_id order by d.sort_order) filter (where d.id is not null), '{}') as types
    from public.visit v
    left join public.display d on d.visit_id = v.id and d.deleted_at is null and d.source = 'assigned'
    where v.workday_id = p_from and v.deleted_at is null
    group by v.store_id, v.task, v.sort_order
    order by v.sort_order
  loop
    if not exists (select 1 from public.visit x where x.workday_id = p_to and x.store_id = r.store_id and x.deleted_at is null) then
      perform public.add_visit(p_to, p_store => r.store_id, p_task => r.task, p_display_types => r.types);
      added := added + 1;
    end if;
  end loop;
  return added;
end $$;

-- Pending and closed visits from earlier days of a merchandiser in my scope, for
-- "Sumar pendientes" when assigning (same rules as resumable_visits; RLS limits it).
create function public.merchandiser_pending(p_company uuid, p_merchandiser uuid, p_before date)
returns table (visit_id uuid, work_date date, store_name text, address text,
               work_status public.work_status, finished_at timestamptz, pending_displays integer)
language sql stable security invoker set search_path = '' as $$
  select v.id, v.work_date, s.name, s.address, v.work_status, v.finished_at,
         (select count(*) from public.display d
          where d.visit_id = v.id and d.deleted_at is null
            and not exists (select 1 from public.photo f
                            where f.display_id = d.id and f.kind = 'after' and f.deleted_at is null))::integer
  from public.visit v
  join public.store s on s.id = v.store_id
  where v.company_id = p_company
    and v.merchandiser_id = p_merchandiser
    and v.work_date < p_before and v.work_date >= p_before - 14
    and v.deleted_at is null
    and v.work_status in ('pending', 'closed')
    and not exists (select 1 from public.visit r where r.resumed_from = v.id and r.deleted_at is null)
  order by v.work_date desc, v.sort_order;
$$;

revoke all on function public.report_sync, public.team_day, public.request_fix, public.plan_workday,
  public.copy_workday, public.merchandiser_pending from public, anon;
grant execute on function public.report_sync, public.team_day, public.request_fix, public.plan_workday,
  public.copy_workday, public.merchandiser_pending to authenticated;
