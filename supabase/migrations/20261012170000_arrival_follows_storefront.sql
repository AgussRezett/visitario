-- =============================================================================
-- The storefront photo is the arrival, so it decides whether a visit has started:
--   * once the storefront photo is uploaded, a pending visit is in progress;
--   * when the last storefront photo is deleted (wrong address, finished by mistake),
--     the visit goes back to pending and loses its arrival and the store's answer.
-- Displays, their photos, metrics, brands and notes are kept.
-- =============================================================================

-- Going back to pending from any state is only allowed to this trigger (clients cannot SET
-- through PostgREST); every other transition keeps the usual rules.
create or replace function private.work_transition_is_valid(from_status public.work_status, to_status public.work_status) returns boolean
language sql stable set search_path = '' as $$
  select from_status = to_status
    or (to_status = 'pending' and coalesce(current_setting('visitario.arrival_removed', true), '') = 'on')
    or (from_status, to_status) in (
      ('pending'::public.work_status, 'in_progress'::public.work_status),
      ('pending', 'closed'), ('pending', 'refused'),
      ('in_progress', 'done'), ('in_progress', 'refused'), ('in_progress', 'closed'), ('in_progress', 'pending'),
      ('closed', 'in_progress'),
      ('done', 'in_progress')
    );
$$;

create function private.visit_arrival_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v public.visit%rowtype;
begin
  select * into v from public.visit where id = new.visit_id and company_id = new.company_id;
  if not found then return null; end if;

  -- Uploaded: the visit starts.
  if new.deleted_at is null and new.uploaded_at is not null and old.uploaded_at is null then
    if v.work_status = 'pending' then
      update public.visit set work_status = 'in_progress', arrived_at = coalesce(arrived_at, new.taken_at)
      where id = v.id and company_id = v.company_id;
    end if;
    return null;
  end if;

  -- Deleted: without any storefront photo left, the visit never started.
  if new.deleted_at is not null and old.deleted_at is null
     and v.work_status <> 'pending'
     and not exists (select 1 from public.photo f
                     where f.visit_id = v.id and f.kind = 'storefront' and f.deleted_at is null) then
    perform set_config('visitario.arrival_removed', 'on', true);
    update public.visit
    set work_status = 'pending', arrived_at = null, consent = null, objection = null, retry_after = null
    where id = v.id and company_id = v.company_id;
    perform set_config('visitario.arrival_removed', '', true);
  end if;
  return null;
end $$;

create trigger sync_arrival after update of uploaded_at, deleted_at on public.photo
for each row when (new.kind = 'storefront') execute function private.visit_arrival_sync();

-- Visits already in progress without a storefront photo (left by the old behaviour) go back to pending.
update public.visit v
set work_status = 'pending', arrived_at = null, consent = null, objection = null, retry_after = null
where v.work_status = 'in_progress' and v.deleted_at is null
  and not exists (select 1 from public.photo f where f.visit_id = v.id and f.kind = 'storefront' and f.deleted_at is null);
