-- Clearing a day loaded by mistake (the wrong route was passed): every stop not started yet
-- goes, in one step, instead of one by one. What was started, visited or has photos stays.
-- The same rule as removing one stop: an activador only clears the stops they added (or
-- resumed); a supervisor or admin, any of the day. Soft delete, as everywhere.

create function public.clear_workday(p_workday uuid)
returns table (removed integer, kept integer)
language plpgsql security invoker set search_path = '' as $$
declare
  me   uuid := private.current_person_id();
  w    public.workday%rowtype;
  boss boolean;
begin
  select * into w from public.workday where id = p_workday and deleted_at is null;
  if not found then raise exception 'Workday not found' using errcode = 'P0002'; end if;
  boss := w.company_id in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin'));

  with gone as (
    update public.visit v set deleted_at = now()
    where v.workday_id = p_workday and v.deleted_at is null
      and v.work_status = 'pending' and v.arrived_at is null
      and not exists (select 1 from public.photo f where f.visit_id = v.id and f.deleted_at is null)
      and (boss or v.added_by = me or v.resumed_from is not null)
    returning 1
  )
  select count(*)::integer into removed from gone;
  select count(*)::integer into kept from public.visit v where v.workday_id = p_workday and v.deleted_at is null;
  return next;
end $$;
comment on function public.clear_workday is 'Removes, in one step, every stop of a day not started yet that the person may remove; returns how many went and how many stay.';
revoke all on function public.clear_workday(uuid) from public, anon;
grant execute on function public.clear_workday(uuid) to authenticated;
