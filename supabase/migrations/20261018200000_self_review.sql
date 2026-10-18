-- A supervisor or admin who also visits stores reviews their own visits: the review
-- inbox lists them, and the guard lets them approve or ask a fix on their own work.
-- Only the merchandiser branch of visit_guard changes.

create or replace function private.visit_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me     uuid := private.current_person_id();
  acting text;
begin
  if (new.id, new.company_id, new.workday_id, new.merchandiser_id, new.work_date, new.source, new.added_by, new.resumed_from)
     is distinct from
     (old.id, old.company_id, old.workday_id, old.merchandiser_id, old.work_date, old.source, old.added_by, old.resumed_from) then
    raise exception 'Immutable visit fields' using errcode = '23514';
  end if;

  if coalesce(current_setting('visitario.merging', true), '') = 'on' then
    if (to_jsonb(new) - 'store_id' - 'updated_at' - 'version' - 'updated_by') <> (to_jsonb(old) - 'store_id' - 'updated_at' - 'version' - 'updated_by') then
      raise exception 'Merging only moves visits to another store' using errcode = '23514';
    end if;
    return new;
  end if;

  -- Turning auto-approval on approves what was waiting: only the review changes.
  if coalesce(current_setting('visitario.auto_approving', true), '') = 'on' then
    if (to_jsonb(new) - 'review_status' - 'reviewed_at' - 'reviewed_by' - 'auto_approved' - 'updated_at' - 'version' - 'updated_by')
       <> (to_jsonb(old) - 'review_status' - 'reviewed_at' - 'reviewed_by' - 'auto_approved' - 'updated_at' - 'version' - 'updated_by') then
      raise exception 'Auto-approval only approves' using errcode = '23514';
    end if;
    return new;
  end if;

  if coalesce(current_setting('visitario.store_cleanup', true), '') = 'on' then
    if (to_jsonb(new) - 'deleted_at' - 'updated_at' - 'version' - 'updated_by') <> (to_jsonb(old) - 'deleted_at' - 'updated_at' - 'version' - 'updated_by') then
      raise exception 'Archiving a store only removes its pending stops' using errcode = '23514';
    end if;
    new.updated_by := me;
    return new;
  end if;

  if not private.work_transition_is_valid(old.work_status, new.work_status) then
    raise exception 'Work status transition not allowed: % -> %', old.work_status, new.work_status using errcode = '23514';
  end if;

  if me is not null then
    acting := private.visit_role(old.id);
    if acting is null then
      raise exception 'No permission on this visit' using errcode = '42501';
    end if;

    if acting = 'merchandiser' then
      -- Approved by a supervisor: locked. Approved on its own (auto_approved): still theirs to fix.
      if old.review_status = 'approved' and not old.auto_approved then
        raise exception 'An approved visit is locked' using errcode = '42501';
      end if;
      -- Who also supervises or runs the company reviews their own visits (no one else would).
      if new.review_status <> old.review_status
         and not (old.review_status = 'needs_fix' and new.review_status = 'unreviewed')
         and old.company_id not in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')) then
        raise exception 'A merchandiser can only resubmit a fix' using errcode = '42501';
      end if;
      if new.review_status = 'needs_fix' and old.review_status <> 'needs_fix'
         and not exists (select 1 from public.comment c
                         where c.visit_id = old.id and c.kind = 'fix_request' and c.author_id = me
                           and c.created_at >= old.updated_at) then
        raise exception 'Requesting a fix needs a comment' using errcode = '23514';
      end if;
      if (new.store_id, new.task) is distinct from (old.store_id, old.task) and old.source = 'assigned' then
        raise exception 'Only the supervisor changes the store or task of an assigned visit' using errcode = '42501';
      end if;
    else -- supervisor or admin acting on someone else's visit
      if (new.work_status, new.arrived_at, new.consent, new.objection, new.notes, new.finished_at, new.retry_after, new.rapport)
         is distinct from
         (old.work_status, old.arrived_at, old.consent, old.objection, old.notes, old.finished_at, old.retry_after, old.rapport) then
        raise exception 'Only the merchandiser records the visit work' using errcode = '42501';
      end if;
      if (new.store_id, new.task) is distinct from (old.store_id, old.task) and old.work_status <> 'pending' then
        raise exception 'Only a pending visit can be reassigned' using errcode = '23514';
      end if;
      if new.review_status = 'needs_fix' and old.review_status <> 'needs_fix'
         and not exists (select 1 from public.comment c
                         where c.visit_id = old.id and c.kind = 'fix_request' and c.author_id = me
                           and c.created_at >= old.updated_at) then
        raise exception 'Requesting a fix needs a comment' using errcode = '23514';
      end if;
    end if;
  end if;

  -- Derived stamps
  if new.work_status in ('done', 'refused', 'closed') and old.work_status not in ('done', 'refused', 'closed') then
    new.finished_at := coalesce(new.finished_at, now());
  elsif new.work_status in ('pending', 'in_progress') then
    new.finished_at := null;
    if new.review_status <> 'unreviewed' then new.review_status := 'unreviewed'; end if;
  end if;
  if new.review_status <> old.review_status then
    if new.review_status = 'unreviewed' then
      new.reviewed_by := null; new.reviewed_at := null;
    else
      new.reviewed_by := me; new.reviewed_at := now();
    end if;
  end if;
  new.updated_by := me;
  return new;
end $$;


