-- =============================================================================
-- Stage 5 · Directory: the company's stores with their last visit, for supervisors
-- and admins; fixing a store's data and merging duplicates.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A page of the directory. Search by name, address or customer number; filters:
-- 'unverified' (no exact location), 'added' (created by merchandisers); by area.
-- Visits follow the caller's RLS: a supervisor sees the last visit of their team.
-- -----------------------------------------------------------------------------
create function public.store_directory(p_company uuid, p_query text default null, p_filter text default 'all',
                                       p_area text default null, p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, address text, area text, customer_number text,
               location_status public.location_status, source public.store_source, created_by_name text,
               last_visit_date date, last_visit_status public.work_status, last_visit_review public.review_status,
               last_merchandiser text, visits_30d integer, total bigint)
language sql stable security invoker set search_path = '' as $$
  with base as (
    select s.* from public.store s
    where s.company_id = p_company and s.deleted_at is null
      and (char_length(btrim(coalesce(p_query, ''))) < 2
           or private.normalize(coalesce(s.name, '') || ' ' || s.address || ' ' || coalesce(s.customer_number, ''))
              like '%' || private.normalize(p_query) || '%')
      and (p_filter is distinct from 'unverified' or s.location_status <> 'verified')
      and (p_filter is distinct from 'added' or s.source = 'merchandiser')
      and (p_area is null or s.area = p_area)
  )
  select b.id, b.name, b.address, b.area, b.customer_number, b.location_status, b.source, cp.first_name,
         lv.work_date, lv.work_status, lv.review_status, lv.first_name,
         (select count(*)::integer from public.visit v
          where v.store_id = b.id and v.deleted_at is null and v.work_date >= current_date - 30),
         count(*) over ()
  from base b
  left join public.person cp on cp.id = b.created_by
  left join lateral (
    select v.work_date, v.work_status, v.review_status, mp.first_name
    from public.visit v join public.person mp on mp.id = v.merchandiser_id
    where v.store_id = b.id and v.deleted_at is null
    order by v.work_date desc, v.sort_order desc
    limit 1
  ) lv on true
  order by b.name nulls last, b.address
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;

-- Counts for the filter chips and the areas to filter by.
create function public.store_directory_counts(p_company uuid)
returns table (total integer, unverified integer, added integer, areas text[])
language sql stable security invoker set search_path = '' as $$
  select count(*)::integer,
         count(*) filter (where s.location_status <> 'verified')::integer,
         count(*) filter (where s.source = 'merchandiser')::integer,
         coalesce(array_agg(distinct s.area order by s.area) filter (where s.area is not null), '{}')
  from public.store s
  where s.company_id = p_company and s.deleted_at is null;
$$;

-- -----------------------------------------------------------------------------
-- Merging: the visits of the duplicate move to the store that stays, which keeps
-- its own data and takes what only the duplicate had. The duplicate is soft-deleted
-- and points to the one that stayed.
-- -----------------------------------------------------------------------------
create function public.merge_stores(p_keep uuid, p_drop uuid)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  k public.store%rowtype;
  d public.store%rowtype;
  moved integer;
begin
  select * into k from public.store where id = p_keep and deleted_at is null;
  select * into d from public.store where id = p_drop and deleted_at is null;
  if k.id is null or d.id is null or k.company_id <> d.company_id or k.id = d.id then
    raise exception 'Store not found' using errcode = 'P0002';
  end if;
  if k.company_id not in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')) then
    raise exception 'Only supervisors and admins merge stores' using errcode = '42501';
  end if;

  -- The duplicate leaves first, so its customer number can move to the one that stays.
  update public.store set deleted_at = now(), merged_into = k.id,
         customer_number = case when k.customer_number is null then null else customer_number end
  where id = d.id;
  update public.store set
    customer_number = coalesce(k.customer_number, d.customer_number),
    name = coalesce(k.name, d.name),
    area = coalesce(k.area, d.area),
    lat = case when k.location_status = 'verified' or d.lat is null then k.lat else d.lat end,
    lng = case when k.location_status = 'verified' or d.lat is null then k.lng else d.lng end,
    location_status = case when k.location_status = 'verified' or d.lat is null then k.location_status else d.location_status end
  where id = k.id;

  perform set_config('visitario.merging', 'on', true);
  update public.visit set store_id = k.id where store_id = d.id;
  get diagnostics moved = row_count;
  perform set_config('visitario.merging', '', true);
  return moved;
end $$;

revoke all on function public.store_directory, public.store_directory_counts, public.merge_stores from public, anon;
grant execute on function public.store_directory, public.store_directory_counts, public.merge_stores to authenticated;

-- -----------------------------------------------------------------------------
-- Visit guard: the same rules, plus merging (inside merge_stores only) may move any
-- visit, approved or finished, to the store that stays.
-- -----------------------------------------------------------------------------
create or replace function private.visit_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me     uuid := private.current_person_id();
  acting text;
begin
  if (new.id, new.company_id, new.workday_id, new.merchandiser_id, new.work_date, new.source, new.added_by, new.resumed_from)
     is distinct from
     (old.id, old.company_id, old.workday_id, old.merchandiser_id, old.work_date, old.source, old.added_by, old.resumed_from) then
    raise exception 'Immutable visit fields' using errcode = '23514';
  end if;

  if coalesce(current_setting('visitario.merging', true), '') = 'on' then
    if (to_jsonb(new) - 'store_id' - 'updated_at' - 'version' - 'updated_by') <> (to_jsonb(old) - 'store_id' - 'updated_at' - 'version' - 'updated_by') then
      raise exception 'Merging only moves visits to another store' using errcode = '23514';
    end if;
    return new;
  end if;

  if not private.work_transition_is_valid(old.work_status, new.work_status) then
    raise exception 'Work status transition not allowed: % -> %', old.work_status, new.work_status using errcode = '23514';
  end if;

  if me is not null then
    acting := private.visit_role(old.id);
    if acting is null then
      raise exception 'No permission on this visit' using errcode = '42501';
    end if;

    if acting = 'merchandiser' then
      if old.review_status = 'approved' then
        raise exception 'An approved visit is locked' using errcode = '42501';
      end if;
      if new.review_status <> old.review_status
         and not (old.review_status = 'needs_fix' and new.review_status = 'unreviewed') then
        raise exception 'A merchandiser can only resubmit a fix' using errcode = '42501';
      end if;
      if (new.store_id, new.task) is distinct from (old.store_id, old.task) and old.source = 'assigned' then
        raise exception 'Only the supervisor changes the store or task of an assigned visit' using errcode = '42501';
      end if;
    else -- supervisor or admin acting on someone else's visit
      if (new.work_status, new.arrived_at, new.consent, new.objection, new.notes, new.finished_at, new.retry_after)
         is distinct from
         (old.work_status, old.arrived_at, old.consent, old.objection, old.notes, old.finished_at, old.retry_after) then
        raise exception 'Only the merchandiser records the visit work' using errcode = '42501';
      end if;
      if (new.store_id, new.task) is distinct from (old.store_id, old.task) and old.work_status <> 'pending' then
        raise exception 'Only a pending visit can be reassigned' using errcode = '23514';
      end if;
      if new.review_status = 'needs_fix' and old.review_status <> 'needs_fix'
         and not exists (select 1 from public.comment c
                         where c.visit_id = old.id and c.kind = 'fix_request' and c.author_id = me
                           and c.created_at >= old.updated_at) then
        raise exception 'Requesting a fix needs a comment' using errcode = '23514';
      end if;
    end if;
  end if;

  -- Derived stamps
  if new.work_status in ('done', 'refused', 'closed') and old.work_status not in ('done', 'refused', 'closed') then
    new.finished_at := coalesce(new.finished_at, now());
  elsif new.work_status in ('pending', 'in_progress') then
    new.finished_at := null;
    if new.review_status <> 'unreviewed' then new.review_status := 'unreviewed'; end if;
  end if;
  if new.review_status <> old.review_status then
    if new.review_status = 'unreviewed' then
      new.reviewed_by := null; new.reviewed_at := null;
    else
      new.reviewed_by := me; new.reviewed_at := now();
    end if;
  end if;
  new.updated_by := me;
  return new;
end $$;
