-- =============================================================================
-- 1. Stores are saved tidy, however they come in (a spreadsheet, a capture, pasted
--    text, "Agregar dirección", the directory): "MANUELA PEDRAZA 3526" → "Manuela
--    Pedraza 3526", "COGHLAN" → "Coghlan". Words with digits stay as written;
--    connectors (de, la, y...) go in lower case; roman numerals and initials
--    (S.A.) in upper case. Existing stores are tidied once here.
-- 2. Archiving a store takes it out of the open days: its pending stops from today
--    on are removed (started or finished ones stay), and no new stop can use it.
-- 3. An archived store can be removed for good: it leaves the directory and can't
--    come back, but its visits stay in reports and history with its address.
-- =============================================================================

-- ---- 1. Tidy text -----------------------------------------------------------
create function private.tidy_text(t text) returns text
language plpgsql immutable parallel safe set search_path = '' as $$
declare
  w    text;
  prev text := '';
  i    integer := 0;
  out text[] := '{}';
begin
  if t is null then return null; end if;
  t := btrim(regexp_replace(t, '\s+', ' ', 'g'));
  if t = '' then return null; end if;
  foreach w in array string_to_array(t, ' ') loop
    i := i + 1;
    if w ~ '[0-9]' then
      out := out || w;                                   -- 3526, 4B, 2do
    elsif w ~* '^([a-z]\.){2,}$' or w ~* '^[ivx]{1,6}$' then
      out := out || upper(w);                            -- S.A., XXIII
    elsif i > 1 and (lower(w) in ('de', 'del', 'y', 'e')
                     or (lower(w) in ('la', 'las', 'los', 'el') and lower(prev) in ('de', 'a'))) then
      out := out || lower(w);                            -- Soldado de la Independencia
    else
      out := out || initcap(w);                          -- also O'Higgins, Av., Almacén La Esquina
    end if;
    prev := w;
  end loop;
  return array_to_string(out, ' ');
end $$;

create function private.store_tidy() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.name := private.tidy_text(new.name);
  new.address := private.tidy_text(new.address);
  new.area := private.tidy_text(new.area);
  return new;
end $$;

create trigger tidy before insert or update of name, address, area on public.store
for each row execute function private.store_tidy();

update public.store
set name = private.tidy_text(name), address = private.tidy_text(address), area = private.tidy_text(area)
where name is distinct from private.tidy_text(name)
   or address is distinct from private.tidy_text(address)
   or area is distinct from private.tidy_text(area);

-- ---- 3. Removed stores ------------------------------------------------------
alter table public.store add column removed_at timestamptz;
alter table public.store add constraint store_removed_is_archived check (removed_at is null or deleted_at is not null);
comment on column public.store.removed_at is 'Removed for good from the directory; its visits keep pointing to it.';

-- A removed store does not change any more (nor comes back).
create function private.store_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.removed_at is not null then
    raise exception 'A removed store cannot change' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger guard before update on public.store
for each row execute function private.store_guard();

create function public.remove_store(p_store uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.store%rowtype;
begin
  select * into s from public.store where id = p_store;
  if not found or s.company_id not in (select private.companies_with_role('supervisor')
                                       union select private.companies_with_role('admin')) then
    raise exception 'Only supervisors and admins remove stores' using errcode = '42501';
  end if;
  if s.deleted_at is null or s.merged_into is not null then
    raise exception 'Only an archived store can be removed' using errcode = '23514';
  end if;
  update public.store set removed_at = now() where id = s.id and removed_at is null;
end $$;

-- ---- 2. Archiving leaves the open days ---------------------------------------
-- Pending stops of a store from today on (Argentina): what archiving removes.
create function private.store_open_stops(p_store uuid) returns setof uuid
language sql stable set search_path = '' as $$
  select v.id from public.visit v
  where v.store_id = p_store and v.deleted_at is null and v.work_status = 'pending'
    and v.work_date >= (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

-- How many stops archiving would remove, for the confirmation (supervisors and admins).
create function public.store_open_stops_count(p_store uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from private.store_open_stops(p_store)
  where exists (select 1 from public.store s where s.id = p_store
                and s.company_id in (select private.companies_with_role('supervisor')
                                     union select private.companies_with_role('admin')));
$$;

create function private.store_archived() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('visitario.store_cleanup', 'on', true);
  update public.visit set deleted_at = now() where id in (select private.store_open_stops(new.id));
  perform set_config('visitario.store_cleanup', '', true);
  return null;
end $$;

-- Merging moves the visits instead (merged_into is set), so it is not archiving.
create trigger archived after update of deleted_at on public.store
for each row when (old.deleted_at is null and new.deleted_at is not null and new.merged_into is null)
execute function private.store_archived();

-- Stores archived before this: out of the open days too.
select set_config('visitario.store_cleanup', 'on', true);
update public.visit v set deleted_at = now()
from public.store s
where s.id = v.store_id and s.deleted_at is not null and s.merged_into is null
  and v.deleted_at is null and v.work_status = 'pending'
  and v.work_date >= (now() at time zone 'America/Argentina/Buenos_Aires')::date;
select set_config('visitario.store_cleanup', '', true);

-- No new stop for an archived store (copying a day, resuming, a stale id).
create function private.visit_store_active() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.store s where s.id = new.store_id and s.deleted_at is not null) then
    raise exception 'The store is archived' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger store_active before insert or update of store_id on public.visit
for each row when (new.deleted_at is null)
execute function private.visit_store_active();

-- Copying a day skips archived stores (same function as 20261012190000_supervisor otherwise).
create or replace function public.copy_workday(p_from uuid, p_to uuid)
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
    join public.store s on s.id = v.store_id and s.deleted_at is null
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

-- A supervisor's "Sumar pendientes" leaves archived stores out too.
create or replace function public.merchandiser_pending(p_company uuid, p_merchandiser uuid, p_before date)
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
    and s.deleted_at is null
    and v.work_status in ('pending', 'closed')
    and not exists (select 1 from public.visit r where r.resumed_from = v.id and r.deleted_at is null)
  order by v.work_date desc, v.sort_order;
$$;

-- The visit guards let the cleanup through: it only removes pending stops.
create or replace function private.visit_delete_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
begin
  if coalesce(current_setting('visitario.store_cleanup', true), '') = 'on' then return new; end if;
  if me is null or private.visit_role(old.id) <> 'merchandiser' then return new; end if;
  if old.added_by <> me and old.resumed_from is null then
    raise exception 'Only the supervisor removes an assigned visit' using errcode = '42501';
  end if;
  return new;
end $$;

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

  if coalesce(current_setting('visitario.store_cleanup', true), '') = 'on' then
    if (to_jsonb(new) - 'deleted_at' - 'updated_at' - 'version' - 'updated_by') <> (to_jsonb(old) - 'deleted_at' - 'updated_at' - 'version' - 'updated_by') then
      raise exception 'Archiving a store only removes its pending stops' using errcode = '23514';
    end if;
    new.updated_by := me;
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
      if (new.work_status, new.arrived_at, new.consent, new.objection, new.notes, new.finished_at, new.retry_after, new.rapport)
         is distinct from
         (old.work_status, old.arrived_at, old.consent, old.objection, old.notes, old.finished_at, old.retry_after, old.rapport) then
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

-- ---- Directory: removed stores are out of every list -------------------------
create or replace function public.store_directory(p_company uuid, p_query text default null, p_filter text default 'all',
                                                  p_area text default null, p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, address text, area text, customer_number text,
               location_status public.location_status, source public.store_source, created_by_name text,
               last_visit_date date, last_visit_status public.work_status, last_visit_review public.review_status,
               last_merchandiser text, visits_30d integer, total bigint)
language sql stable security invoker set search_path = '' as $$
  with base as (
    select s.* from public.store s
    where s.company_id = p_company
      -- 'archived': taken out by hand (merged duplicates and removed stores stay out of sight)
      and (case when p_filter = 'archived' then s.deleted_at is not null and s.merged_into is null and s.removed_at is null
                else s.deleted_at is null end)
      and (char_length(btrim(coalesce(p_query, ''))) < 2
           or private.normalize(coalesce(s.name, '') || ' ' || s.address || ' ' || coalesce(s.customer_number, ''))
              like '%' || private.normalize(p_query) || '%')
      and (p_filter is distinct from 'unverified' or s.location_status <> 'verified')
      and (p_filter is distinct from 'added' or s.source = 'merchandiser')
      and (p_area is null or s.area = p_area)
  ),
  counted as (
    select v.* from public.visit v
    where v.deleted_at is null
      and not exists (select 1 from public.visit c where c.resumed_from = v.id and c.deleted_at is null)
  )
  select b.id, b.name, b.address, b.area, b.customer_number, b.location_status, b.source, cp.first_name,
         lv.work_date, lv.work_status, lv.review_status, lv.first_name,
         (select count(*)::integer from counted v where v.store_id = b.id and v.work_date >= current_date - 30),
         count(*) over ()
  from base b
  left join public.person cp on cp.id = b.created_by
  left join lateral (
    select v.work_date, v.work_status, v.review_status, mp.first_name
    from counted v join public.person mp on mp.id = v.merchandiser_id
    where v.store_id = b.id
    order by v.work_date desc, v.sort_order desc
    limit 1
  ) lv on true
  order by b.name nulls last, b.address
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;

revoke all on function public.remove_store(uuid), public.store_open_stops_count(uuid) from public, anon;
grant execute on function public.remove_store(uuid), public.store_open_stops_count(uuid) to authenticated;
revoke all on function private.tidy_text(text), private.store_open_stops(uuid) from public, anon;
grant execute on function private.tidy_text(text), private.store_open_stops(uuid) to authenticated;
