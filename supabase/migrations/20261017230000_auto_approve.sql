-- =============================================================================
-- Visits that approve themselves, for merchandisers nobody reviews: an admin turns on
-- membership.auto_approve for a person; their visits are approved when they finish
-- them (never in the review inbox), and what was waiting gets approved at that moment.
-- A visit approved this way (visit.auto_approved) stays editable for the merchandiser;
-- one a supervisor approved stays locked. Going back to work makes it unreviewed again.
-- =============================================================================
alter table public.membership add column auto_approve boolean not null default false;
comment on column public.membership.auto_approve is 'Their finished visits are approved without review.';
grant update (auto_approve) on public.membership to authenticated;  -- the admin policy decides who

alter table public.visit add column auto_approved boolean not null default false;
comment on column public.visit.auto_approved is 'Approved on finishing, because the merchandiser is not reviewed.';

-- After the guards (triggers run in name order: guard, guard_delete, guard_finish, review_auto).
create function private.visit_review_auto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.work_status in ('done', 'refused', 'closed') and new.review_status = 'unreviewed'
     and (old.work_status not in ('done', 'refused', 'closed') or old.review_status <> 'unreviewed')
     and exists (select 1 from public.membership m
                 where m.company_id = new.company_id and m.person_id = new.merchandiser_id and m.auto_approve) then
    new.review_status := 'approved';
    new.reviewed_at := now();
    new.reviewed_by := null;
    new.auto_approved := true;
  elsif new.review_status <> 'approved' then
    new.auto_approved := false;
  end if;
  return new;
end $$;

create trigger review_auto before update on public.visit
for each row execute function private.visit_review_auto();

-- Turning it on approves their finished visits that were waiting for review.
create function private.membership_auto_approve() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('visitario.auto_approving', 'on', true);
  update public.visit
  set review_status = 'approved', reviewed_at = now(), reviewed_by = null, auto_approved = true
  where company_id = new.company_id and merchandiser_id = new.person_id and deleted_at is null
    and review_status = 'unreviewed' and work_status in ('done', 'refused', 'closed');
  perform set_config('visitario.auto_approving', '', true);
  return null;
end $$;

create trigger auto_approve after update of auto_approve on public.membership
for each row when (new.auto_approve and not old.auto_approve)
execute function private.membership_auto_approve();

-- Visit guard: as in 20261017160000_store_tidy_and_remove, plus the auto-approval
-- bypass and auto-approved visits not locked for the merchandiser.
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
      if new.review_status <> old.review_status
         and not (old.review_status = 'needs_fix' and new.review_status = 'unreviewed') then
        raise exception 'A merchandiser can only resubmit a fix' using errcode = '42501';
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

