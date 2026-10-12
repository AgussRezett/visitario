-- =============================================================================
-- Removing a stop from the day (soft delete). A merchandiser may remove the stops
-- they added themselves or resumed from another day (the original becomes
-- resumable again); what a supervisor assigned stays. Approved visits stay locked
-- (visit_guard). Supervisors keep removing within their scope.
-- =============================================================================

create function private.visit_delete_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
begin
  if me is null or private.visit_role(old.id) <> 'merchandiser' then return new; end if;
  if old.added_by <> me and old.resumed_from is null then
    raise exception 'Only the supervisor removes an assigned visit' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger guard_delete before update of deleted_at on public.visit
for each row when (new.deleted_at is not null and old.deleted_at is null)
execute function private.visit_delete_guard();
