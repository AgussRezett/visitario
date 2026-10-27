-- =============================================================================
-- The last route calculated for a workday: the order, how long and far it is, and the
-- path by streets. It stays so the activador sees the map and the totals when coming
-- back, with the stops already done marked instead of taken off.
--
-- Location is never stored: a route that starts at the phone's position keeps only the
-- path from the first store on (the app trims it before saving), and no origin.
-- =============================================================================

create table public.route_plan (
  workday_id      uuid primary key references public.workday (id) on delete cascade,
  company_id      uuid not null references public.company (id) on delete cascade,
  merchandiser_id uuid not null references public.person (id) on delete cascade,
  mode            text not null check (mode in ('driving', 'walking')),
  -- Only that it started at the phone, for the copy: never where.
  from_origin     boolean not null default false,
  stop_ids        uuid[] not null check (cardinality(stop_ids) between 1 and 100 and array_position(stop_ids, null) is null),
  km              numeric(8, 2) not null check (km >= 0 and km < 10000),
  minutes         integer check (minutes between 0 and 100000),
  by_street       boolean not null default false,
  -- [[lng, lat], ...] by streets, from the first store on.
  line            jsonb check (line is null or (jsonb_typeof(line) = 'array' and jsonb_array_length(line) <= 20000)),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  version         integer not null default 1
);
create index route_plan_company on public.route_plan (company_id, merchandiser_id);

create trigger touch before insert or update on public.route_plan for each row execute function private.touch();

alter table public.route_plan enable row level security;
alter table public.route_plan force row level security;

-- Whoever sees the workday sees its route (the activador, their supervisor, the admin).
create policy route_plan_select on public.route_plan for select to authenticated
  using ((company_id, merchandiser_id) in (select * from private.visible_merchandisers()));
grant select on public.route_plan to authenticated;

-- Only the activador saves the route of their own day (the last one replaces the one before).
create function public.save_route_plan(p_workday uuid, p_mode text, p_from_origin boolean, p_stop_ids uuid[],
                                       p_km numeric, p_by_street boolean, p_minutes integer default null, p_line jsonb default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  w public.workday%rowtype;
begin
  select * into w from public.workday where id = p_workday and deleted_at is null;
  if not found or w.merchandiser_id is distinct from private.current_person_id() then
    raise exception 'Only the activador saves the route of their day' using errcode = '42501';
  end if;
  insert into public.route_plan (workday_id, company_id, merchandiser_id, mode, from_origin, stop_ids, km, minutes, by_street, line)
  values (w.id, w.company_id, w.merchandiser_id, p_mode, coalesce(p_from_origin, false), p_stop_ids, p_km, p_minutes, coalesce(p_by_street, false), p_line)
  on conflict (workday_id) do update
    set mode = excluded.mode, from_origin = excluded.from_origin, stop_ids = excluded.stop_ids, km = excluded.km,
        minutes = excluded.minutes, by_street = excluded.by_street, line = excluded.line;
end $$;

revoke all on function public.save_route_plan(uuid, text, boolean, uuid[], numeric, boolean, integer, jsonb) from public, anon;
grant execute on function public.save_route_plan(uuid, text, boolean, uuid[], numeric, boolean, integer, jsonb) to authenticated;
