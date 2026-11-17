-- =============================================================================
-- Armar recorrido: the supervisor picks a goal and filters, Visitario chooses the stores
-- that serve it best and are close together, and the route goes into someone's day.
--   · route_zone: areas drawn on the map ("Palermo Norte"), shared by the company.
--   · route_candidates: what each store has pending (a seller's request, open novedades)
--     and whose day it is already in on that date.
--   · add_stores_to_day: the chosen stores into a day, in the route's order.
-- =============================================================================

create table public.route_zone (
  id          uuid primary key default private.uuid_v7(),
  company_id  uuid not null references public.company (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  -- [[lng, lat], ...], the polygon as drawn (closed by the app).
  ring        jsonb not null check (jsonb_typeof(ring) = 'array' and jsonb_array_length(ring) between 3 and 200),
  created_by  uuid references public.person (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  version     integer not null default 1,
  deleted_at  timestamptz
);
comment on table public.route_zone is 'An area drawn on the map, to plan routes inside it.';
create unique index route_zone_name on public.route_zone (company_id, lower(btrim(name))) where deleted_at is null;
create trigger touch before insert or update on public.route_zone for each row execute function private.touch();

alter table public.route_zone enable row level security;
alter table public.route_zone force row level security;
revoke all on public.route_zone from anon, authenticated;
create policy route_zone_select on public.route_zone for select to authenticated
  using (company_id in (select private.my_companies()));
create policy route_zone_insert on public.route_zone for insert to authenticated
  with check (private.is_boss(company_id) and created_by = (select private.current_person_id()));
create policy route_zone_update on public.route_zone for update to authenticated
  using (private.is_boss(company_id)) with check (private.is_boss(company_id));
-- No deletes: a zone is put away with deleted_at.
grant select on public.route_zone to authenticated;
grant insert (company_id, name, ring, created_by) on public.route_zone to authenticated;
grant update (name, ring, deleted_at) on public.route_zone to authenticated;

-- What each store has pending on a date, for a supervisor or admin planning it. Only the
-- stores with something to say.
create function public.route_candidates(p_company uuid, p_date date)
returns table (store_id uuid, open_request boolean, request_by text, open_issues integer, planned_for text)
language sql stable security definer set search_path = '' as $$
  with req as (
    select a.store_id, p.first_name from public.activation_request a join public.person p on p.id = a.requested_by
    where a.company_id = p_company and a.status = 'open' and a.deleted_at is null
  ),
  iss as (
    select i.store_id, count(*)::integer n from public.store_issue i
    where i.company_id = p_company and i.status = 'open' and i.deleted_at is null group by i.store_id
  ),
  planned as (
    select v.store_id, string_agg(distinct p.first_name, ', ') who from public.visit v join public.person p on p.id = v.merchandiser_id
    where v.company_id = p_company and v.work_date = p_date and v.deleted_at is null group by v.store_id
  ),
  ids as (select store_id from req union select store_id from iss union select store_id from planned)
  select ids.store_id, req.store_id is not null, req.first_name, coalesce(iss.n, 0), planned.who
  from ids
  left join req on req.store_id = ids.store_id
  left join iss on iss.store_id = ids.store_id
  left join planned on planned.store_id = ids.store_id
  where private.is_boss(p_company)
$$;
revoke all on function public.route_candidates(uuid, date) from public, anon;
grant execute on function public.route_candidates(uuid, date) to authenticated;

-- The chosen stores into a day, in order; the ones already in it are skipped. With the
-- caller's own permissions (add_visit decides who may add to whose day).
create function public.add_stores_to_day(p_workday uuid, p_stores uuid[]) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  s uuid;
  added integer := 0;
begin
  if coalesce(array_length(p_stores, 1), 0) > 30 then
    raise exception 'Up to 30 stores at once' using errcode = '22023';
  end if;
  foreach s in array coalesce(p_stores, '{}') loop
    if not exists (select 1 from public.visit v where v.workday_id = p_workday and v.store_id = s and v.deleted_at is null) then
      perform public.add_visit(p_workday, p_store => s);
      added := added + 1;
    end if;
  end loop;
  return added;
end $$;
revoke all on function public.add_stores_to_day(uuid, uuid[]) from public, anon;
grant execute on function public.add_stores_to_day(uuid, uuid[]) to authenticated;
