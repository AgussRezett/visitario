-- =============================================================================
-- A route the activador ordered by hand (dragging the stops) instead of the suggested
-- one: the day remembers it, so it shows as "Recorrido personalizado" when coming back.
-- save_route_plan takes p_custom (default false, so callers without it keep working).
-- =============================================================================
alter table public.route_plan add column custom boolean not null default false;

drop function public.save_route_plan(uuid, text, boolean, uuid[], numeric, boolean, integer, jsonb);

create function public.save_route_plan(p_workday uuid, p_mode text, p_from_origin boolean, p_stop_ids uuid[],
                                       p_km numeric, p_by_street boolean, p_minutes integer default null, p_line jsonb default null,
                                       p_custom boolean default false)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  w public.workday%rowtype;
begin
  select * into w from public.workday where id = p_workday and deleted_at is null;
  if not found or w.merchandiser_id is distinct from private.current_person_id() then
    raise exception 'Only the activador saves the route of their day' using errcode = '42501';
  end if;
  insert into public.route_plan (workday_id, company_id, merchandiser_id, mode, from_origin, stop_ids, km, minutes, by_street, line, custom)
  values (w.id, w.company_id, w.merchandiser_id, p_mode, coalesce(p_from_origin, false), p_stop_ids, p_km, p_minutes, coalesce(p_by_street, false), p_line, coalesce(p_custom, false))
  on conflict (workday_id) do update
    set mode = excluded.mode, from_origin = excluded.from_origin, stop_ids = excluded.stop_ids, km = excluded.km,
        minutes = excluded.minutes, by_street = excluded.by_street, line = excluded.line, custom = excluded.custom;
end $$;

revoke all on function public.save_route_plan(uuid, text, boolean, uuid[], numeric, boolean, integer, jsonb, boolean) from public, anon;
grant execute on function public.save_route_plan(uuid, text, boolean, uuid[], numeric, boolean, integer, jsonb, boolean) to authenticated;
