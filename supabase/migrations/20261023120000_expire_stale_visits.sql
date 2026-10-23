-- =============================================================================
-- A visit left in progress for 12 hours never happened: it goes back to pending, as if
-- nobody had arrived, and the next day it is offered with the other pending ones.
--   · gone: arrival, the store's answer, notes, rating, work numbers, brands, photos
--     (soft-deleted: the daily purge removes them from R2 after 30 days) and the displays
--     the merchandiser found;
--   · kept: the stop itself, its task, the displays the supervisor assigned, the
--     conversation and the history (an automatic "in_progress → pending" with no actor).
-- Runs every hour (supabase/cron/expire.sql); nobody calls it from the app.
-- =============================================================================

create function private.expire_stale_visits() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  stale uuid[];
begin
  select coalesce(array_agg(id), '{}') into stale
  from public.visit
  where work_status = 'in_progress'
    and deleted_at is null
    and coalesce(arrived_at, updated_at) < now() - interval '12 hours';
  if cardinality(stale) = 0 then return 0; end if;

  -- The visit first: once pending, the storefront trigger has nothing left to do.
  perform set_config('visitario.arrival_removed', 'on', true);
  update public.visit
  set work_status = 'pending', arrived_at = null, consent = null, objection = null,
      retry_after = null, finished_at = null, notes = null, rapport = null
  where id = any (stale);
  perform set_config('visitario.arrival_removed', '', true);

  update public.photo set deleted_at = now()
  where visit_id = any (stale) and deleted_at is null;
  update public.display set deleted_at = now()
  where visit_id = any (stale) and source = 'found' and deleted_at is null;
  delete from public.visit_metric where visit_id = any (stale);
  delete from public.visit_brand where visit_id = any (stale);

  return cardinality(stale);
end $$;

revoke all on function private.expire_stale_visits() from public, anon, authenticated;
