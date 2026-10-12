-- =============================================================================
-- Visitario v2 · Stage 1: the merchandiser's day
-- Finishing rules for a visit, and RPCs for opening a workday, adding an
-- address, searching the directory and resuming pending visits.
-- RPCs run as the caller (security invoker): RLS and the existing guards apply.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A visit ends (done, refused, closed) only after arriving with the storefront
-- photo; "done" also needs the store's consent.
-- -----------------------------------------------------------------------------
create function private.visit_finish_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.work_status in ('done', 'refused', 'closed') and new.work_status <> old.work_status then
    if not exists (select 1 from public.photo f
                   where f.visit_id = new.id and f.kind = 'storefront' and f.deleted_at is null) then
      raise exception 'A visit needs the storefront photo before it ends' using errcode = '23514';
    end if;
    if new.work_status = 'done' and coalesce(new.consent::text, '') not in ('yes', 'with_objection') then
      raise exception 'A finished visit needs the store''s consent' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
-- Named to run after "guard" (triggers fire in name order), so invalid transitions fail first.
create trigger guard_finish before update on public.visit
  for each row execute function private.visit_finish_guard();

-- -----------------------------------------------------------------------------
-- Opens the caller's own workday for a date, or returns the one that exists.
-- -----------------------------------------------------------------------------
create function public.open_workday(p_company uuid, p_date date) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  me  uuid := private.current_person_id();
  wid uuid;
begin
  if me is null then raise exception 'Complete your identity first' using errcode = '42501'; end if;
  select id into wid from public.workday
  where company_id = p_company and merchandiser_id = me and work_date = p_date;
  if wid is not null then
    update public.workday set deleted_at = null where id = wid and deleted_at is not null;
    return wid;
  end if;
  insert into public.workday (company_id, merchandiser_id, work_date, status, created_by)
  values (p_company, me, p_date, 'published', me)
  on conflict (company_id, merchandiser_id, work_date) do nothing
  returning id into wid;
  if wid is null then  -- a supervisor's draft exists and is not visible yet
    raise exception 'Your supervisor is preparing that workday' using errcode = '23505';
  end if;
  return wid;
end $$;

-- -----------------------------------------------------------------------------
-- Adds a store to a workday: an existing one (p_store) or a new one from the
-- address fields. Returns the visit id; adding the same store twice returns the
-- visit already there.
-- -----------------------------------------------------------------------------
create function public.add_visit(
  p_workday         uuid,
  p_store           uuid default null,
  p_address         text default null,
  p_name            text default null,
  p_customer_number text default null,
  p_area            text default null,
  p_lat             double precision default null,
  p_lng             double precision default null,
  p_location_status public.location_status default 'unverified',
  p_task            text default null,
  p_display_types   integer[] default '{}',
  p_id              uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  me      uuid := private.current_person_id();
  w       public.workday%rowtype;
  sid     uuid := p_store;
  vid     uuid;
  next_at smallint;
begin
  select * into w from public.workday where id = p_workday and deleted_at is null;
  if not found then raise exception 'Workday not found' using errcode = 'P0002'; end if;

  if sid is null then
    if nullif(btrim(p_address), '') is null then
      raise exception 'A new store needs an address' using errcode = '23502';
    end if;
    insert into public.store (company_id, customer_number, name, address, area, lat, lng, location_status, source, created_by)
    values (w.company_id, nullif(btrim(p_customer_number), ''), nullif(btrim(p_name), ''), btrim(p_address),
            nullif(btrim(p_area), ''), p_lat, p_lng,
            case when p_lat is null then 'unverified'::public.location_status else p_location_status end,
            'merchandiser', me)
    returning id into sid;
  end if;

  select id into vid from public.visit
  where workday_id = p_workday and store_id = sid and deleted_at is null;
  if vid is not null then return vid; end if;

  select coalesce(max(sort_order) + 1, 0) into next_at from public.visit where workday_id = p_workday;
  insert into public.visit (id, company_id, workday_id, merchandiser_id, work_date, store_id, sort_order, task, added_by)
  values (coalesce(p_id, private.uuid_v7()), w.company_id, p_workday, w.merchandiser_id, w.work_date, sid, next_at,
          nullif(btrim(p_task), ''), coalesce(me, w.merchandiser_id))
  returning id into vid;

  insert into public.display (company_id, visit_id, display_type_id, source, sort_order)
  select w.company_id, vid, t.id, 'assigned', t.ord::smallint
  from unnest(p_display_types) with ordinality as t (id, ord);

  return vid;
end $$;

-- -----------------------------------------------------------------------------
-- Directory search by name, address or customer number, accent-insensitive.
-- -----------------------------------------------------------------------------
create function public.search_stores(p_company uuid, p_query text, p_limit integer default 8)
returns table (id uuid, name text, address text, area text, customer_number text,
               location_status public.location_status)
language sql stable security invoker set search_path = '' as $$
  select s.id, s.name, s.address, s.area, s.customer_number, s.location_status
  from public.store s
  where s.company_id = p_company and s.deleted_at is null
    and char_length(btrim(p_query)) >= 2
    and private.normalize(coalesce(s.name, '') || ' ' || s.address || ' ' || coalesce(s.customer_number, ''))
        like '%' || private.normalize(p_query) || '%'
  order by s.name nulls last, s.address
  limit least(greatest(p_limit, 1), 20);
$$;

-- -----------------------------------------------------------------------------
-- The caller's pending or closed visits from the last two weeks before a date
-- that were not resumed yet, with how many displays are still to arrange.
-- -----------------------------------------------------------------------------
create function public.resumable_visits(p_company uuid, p_before date)
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
    and v.merchandiser_id = private.current_person_id()
    and v.work_date < p_before and v.work_date >= p_before - 14
    and v.deleted_at is null
    and v.work_status in ('pending', 'closed')
    and not exists (select 1 from public.visit r where r.resumed_from = v.id and r.deleted_at is null)
  order by v.work_date desc, v.sort_order;
$$;

-- -----------------------------------------------------------------------------
-- resume_visit: a resumed visit goes to the end of the target workday.
-- -----------------------------------------------------------------------------
create or replace function public.resume_visit(p_visit uuid, p_workday uuid, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o public.visit%rowtype;
  nid uuid := coalesce(p_id, private.uuid_v7());
  next_at smallint;
begin
  select * into o from public.visit where id = p_visit;
  if not found or private.visit_role(p_visit) is null then
    raise exception 'Visit not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.workday w
                 where w.id = p_workday and w.company_id = o.company_id and w.deleted_at is null
                   and (w.company_id, w.merchandiser_id) in (select * from private.visible_merchandisers())) then
    raise exception 'Workday not found' using errcode = 'P0002';
  end if;
  if o.work_status not in ('pending', 'closed') then
    raise exception 'Only pending or closed visits can be resumed' using errcode = '23514';
  end if;
  select coalesce(max(sort_order) + 1, 0) into next_at from public.visit where workday_id = p_workday;
  insert into public.visit (id, company_id, workday_id, merchandiser_id, work_date, store_id, sort_order, task,
                            source, added_by, resumed_from)
  values (nid, o.company_id, p_workday, o.merchandiser_id, o.work_date, o.store_id, next_at, o.task,
          o.source, o.added_by, o.id)
  on conflict (id) do nothing;
  insert into public.display (company_id, visit_id, display_type_id, reference, sort_order)
  select d.company_id, nid, d.display_type_id, d.reference, d.sort_order
  from public.display d
  where d.visit_id = o.id and d.deleted_at is null
    and not exists (select 1 from public.photo f where f.display_id = d.id and f.kind = 'after' and f.deleted_at is null)
    and not exists (select 1 from public.display x where x.visit_id = nid);
  return nid;
end $$;

revoke all on function public.open_workday, public.add_visit, public.search_stores, public.resumable_visits
  from public, anon;
grant execute on function public.open_workday, public.add_visit, public.search_stores, public.resumable_visits
  to authenticated;
grant execute on function private.visit_finish_guard to service_role;
