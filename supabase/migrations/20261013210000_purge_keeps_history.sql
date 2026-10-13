-- =============================================================================
-- Retention removes old photos, never how a visit ended: while private.purge() runs,
-- deleting a storefront photo does not send its visit back to pending.
-- =============================================================================
create or replace function private.visit_arrival_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v public.visit%rowtype;
begin
  if coalesce(current_setting('visitario.purging', true), '') = 'on' then return null; end if;
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
