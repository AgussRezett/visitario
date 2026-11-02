-- =============================================================================
-- What counts as an extra visit: not who added it, but when. A store that goes into a
-- merchandiser's day before their shift starts is part of the day's plan ('assigned');
-- one added once the shift started, by anyone, is an extra of the day ('added').
-- The shift is the person's own (membership) or the company's, in Argentina time.
-- =============================================================================

create function private.shift_starts_at(p_company uuid, p_person uuid, p_date date)
returns timestamptz
language sql stable security definer set search_path = '' as $$
  select (p_date + coalesce(m.shift_start, c.shift_start)) at time zone 'America/Argentina/Buenos_Aires'
  from public.company c
  left join public.membership m on m.company_id = c.id and m.person_id = p_person
  where c.id = p_company;
$$;
revoke all on function private.shift_starts_at from public, anon;
grant execute on function private.shift_starts_at to authenticated;

create or replace function private.visit_on_create() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  w  public.workday%rowtype;
begin
  select * into w from public.workday where id = new.workday_id and company_id = new.company_id;
  if not found then raise exception 'Workday not found' using errcode = '23503'; end if;
  new.merchandiser_id := w.merchandiser_id;
  new.work_date := w.work_date;
  new.work_status := 'pending';
  new.review_status := 'unreviewed';
  new.reviewed_by := null; new.reviewed_at := null; new.finished_at := null;
  if me is not null then
    new.added_by := me;
    -- Loaded after the day was over (history from a backup): it keeps the source it came with.
    new.source := case when now() < private.shift_starts_at(w.company_id, w.merchandiser_id, w.work_date) then 'assigned'
                       when (now() at time zone 'America/Argentina/Buenos_Aires')::date <= w.work_date then 'added'
                       else new.source end;
  end if;
  if new.resumed_from is not null then  -- resuming keeps the original author; the time decides the rest
    select o.added_by into new.added_by
    from public.visit o where o.id = new.resumed_from and o.company_id = new.company_id;
  end if;
  new.updated_by := me;
  return new;
end $$;

-- Extra or not is now about time, so the merchandiser's right to change a stop's store or
-- task goes by who put it there: one a supervisor assigned stays the supervisor's.
-- (Same guard as in 20261018200000_self_review; only that condition changes.)
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
      if (new.store_id, new.task) is distinct from (old.store_id, old.task)
         and old.added_by <> old.merchandiser_id and not private.works_operation(old.workday_id) then
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

-- The visits already there, by the same rule (the old one is still readable: added_by = merchandiser_id).
-- Only those created by the end of their day: later ones came from imported history.
set local session_replication_role = replica;
update public.visit v
set source = x.source, updated_at = now(), version = v.version + 1
from (
  select v2.id, case when v2.created_at >= private.shift_starts_at(v2.company_id, v2.merchandiser_id, v2.work_date)
                     then 'added'::public.visit_source else 'assigned'::public.visit_source end as source
  from public.visit v2
  where (v2.created_at at time zone 'America/Argentina/Buenos_Aires')::date <= v2.work_date
) x
where x.id = v.id and x.source is distinct from v.source;
set local session_replication_role = origin;
