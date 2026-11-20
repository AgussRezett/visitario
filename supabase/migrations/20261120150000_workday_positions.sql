-- Where an activador is during their workday, so their supervisor follows them on the map.
-- The activador's phone sends its position while the app is open and the day is under way
-- (today's published workday); each phone says which one it is (device_id), since the same
-- person may be signed in on two. Only they and whoever sees their workdays (their
-- supervisor, the company's admins) can read it. Kept 30 days.

create table public.workday_position (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references public.company (id) on delete cascade,
  workday_id  uuid not null,
  person_id   uuid not null references public.person (id) on delete cascade,
  device_id   text not null check (char_length(device_id) between 1 and 64),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  accuracy    real check (accuracy >= 0),
  recorded_at timestamptz not null default now(),
  foreign key (company_id, workday_id) references public.workday (company_id, id) on delete cascade
);
comment on table public.workday_position is 'An activador''s positions during their workday, for their supervisor''s map. Kept 30 days.';
create index workday_position_day on public.workday_position (workday_id, recorded_at);
create index workday_position_person on public.workday_position (person_id, recorded_at);

alter table public.workday_position enable row level security;
alter table public.workday_position force row level security;
create policy workday_position_select on public.workday_position for select to authenticated
  using ((company_id, person_id) in (select * from private.visible_merchandisers()));
revoke all on public.workday_position from anon, authenticated;
grant select (id, company_id, workday_id, person_id, device_id, lat, lng, accuracy, recorded_at) on public.workday_position to authenticated;

/**
 * The activador's phone says where it is. Only for their own published workday of today (in
 * the company's time zone); a phone that sent less than 10 seconds ago is not stored again.
 * Returns whether it was stored.
 */
create function public.share_day_position(p_workday uuid, p_device text, p_lat double precision, p_lng double precision, p_accuracy real)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  w public.workday%rowtype;
begin
  select * into w from public.workday where id = p_workday and deleted_at is null;
  if w.id is null or w.merchandiser_id is distinct from me
     or w.company_id not in (select m.company_id from public.membership m where m.person_id = me and m.status = 'active') then
    raise exception 'Not your workday' using errcode = '42501';
  end if;
  if w.status = 'draft' or w.work_date <> (select (now() at time zone c.timezone)::date from public.company c where c.id = w.company_id) then
    raise exception 'Only during today''s workday' using errcode = '22023';
  end if;
  if exists (select 1 from public.workday_position p
             where p.workday_id = p_workday and p.device_id = p_device and p.recorded_at > now() - interval '10 seconds') then
    return false;
  end if;
  insert into public.workday_position (company_id, workday_id, person_id, device_id, lat, lng, accuracy)
  values (w.company_id, w.id, me, left(p_device, 64), p_lat, p_lng, p_accuracy);
  -- What is older than 30 days goes, a little at a time.
  delete from public.workday_position where person_id = me and recorded_at < now() - interval '30 days';
  return true;
end $$;
revoke all on function public.share_day_position(uuid, text, double precision, double precision, real) from public, anon;
grant execute on function public.share_day_position(uuid, text, double precision, double precision, real) to authenticated;
