-- =============================================================================
-- The activador checks where a store of their day landed and fixes it: the pin (by the
-- phone's GPS at the door, or moving the map) and the street number of the address.
-- Only that, and only for stores in their own workdays: the rest of the store (channel,
-- seller, customer number, archive...) stays with supervisors and admins, as before.
-- The store remembers who fixed its location and when, for the supervisor to see.
-- =============================================================================
alter table public.store
  add column located_by uuid references public.person (id) on delete set null,
  add column located_at timestamptz;
grant select (located_by, located_at) on public.store to authenticated;

-- A location changed any other way (a supervisor pasting coordinates, checking it again)
-- is no longer the activador's fix.
create function private.store_location_by() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.lat, new.lng) is distinct from (old.lat, old.lng) and new.located_at is not distinct from old.located_at then
    new.located_by := null;
    new.located_at := null;
  end if;
  return new;
end $$;
create trigger location_by before update of lat, lng on public.store
  for each row execute function private.store_location_by();

create function public.fix_store_location(p_store uuid, p_lat double precision, p_lng double precision, p_address text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  s public.store%rowtype;
  new_address text := nullif(btrim(regexp_replace(coalesce(p_address, ''), '\s+', ' ', 'g')), '');
begin
  select * into s from public.store where id = p_store and removed_at is null and merged_into is null;
  if not found or me is null then
    raise exception 'Store not found' using errcode = 'P0002';
  end if;
  -- Supervisors and admins of the company, or an activador with this store in one of their days.
  if s.company_id not in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin'))
     and not exists (
       select 1 from public.visit v
       join public.membership m on m.company_id = v.company_id and m.person_id = me and m.status = 'active' and 'merchandiser' = any (m.roles)
       where v.store_id = s.id and v.merchandiser_id = me and v.deleted_at is null) then
    raise exception 'Only stores of your own workdays' using errcode = '42501';
  end if;
  -- Argentina, roughly: a pin in the sea or abroad is a mistake.
  if p_lat is null or p_lng is null or p_lat not between -55 and -21 or p_lng not between -74 and -53 then
    raise exception 'That location is outside Argentina' using errcode = '22023';
  end if;
  if new_address is not null and char_length(new_address) not between 3 and 200 then
    raise exception 'Address too short or too long' using errcode = '22023';
  end if;
  update public.store
     set lat = p_lat, lng = p_lng, location_status = 'verified', address = coalesce(new_address, s.address),
         located_by = me, located_at = now()
   where id = s.id;
end $$;
revoke all on function public.fix_store_location(uuid, double precision, double precision, text) from public, anon;
grant execute on function public.fix_store_location(uuid, double precision, double precision, text) to authenticated;
