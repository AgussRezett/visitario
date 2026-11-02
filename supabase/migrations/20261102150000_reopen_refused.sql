-- =============================================================================
-- Undoing "finished": a visit marked done or not authorized goes back to in progress, to
-- fix it and finish it again (a closed one already could, with "Volví: probar de nuevo").
-- The guard already makes it unreviewed again and the auto-approval re-approves it when
-- it is finished; a visit a supervisor approved stays locked for the merchandiser.
-- Only change: refused -> in_progress is now a valid transition.
-- =============================================================================
create or replace function private.work_transition_is_valid(from_status public.work_status, to_status public.work_status) returns boolean
language sql stable set search_path = '' as $$
  select from_status = to_status
    or (to_status = 'pending' and coalesce(current_setting('visitario.arrival_removed', true), '') = 'on')
    or (from_status, to_status) in (
      ('pending'::public.work_status, 'in_progress'::public.work_status),
      ('pending', 'closed'), ('pending', 'refused'),
      ('in_progress', 'done'), ('in_progress', 'refused'), ('in_progress', 'closed'), ('in_progress', 'pending'),
      ('closed', 'in_progress'),
      ('done', 'in_progress'),
      ('refused', 'in_progress')
    );
$$;
