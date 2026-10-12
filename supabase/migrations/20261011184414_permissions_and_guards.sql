-- =============================================================================
-- Visitario v2 · Initial schema (2/4): permission helpers and business guards
-- Helpers are SECURITY DEFINER with an empty search_path so nobody can shadow
-- a table. The database enforces the rules even if the app already does.
-- =============================================================================

create function private.current_person_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.person p where p.auth_user_id = auth.uid();
$$;

create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admin a where a.person_id = private.current_person_id());
$$;

-- Companies where I have an active membership.
create function private.my_companies() returns setof uuid
language sql stable security definer rows 5 set search_path = '' as $$
  select m.company_id from public.membership m
  where m.person_id = private.current_person_id() and m.status = 'active';
$$;

-- Companies where I hold a given role.
create function private.companies_with_role(r public.role) returns setof uuid
language sql stable security definer rows 3 set search_path = '' as $$
  select m.company_id from public.membership m
  where m.person_id = private.current_person_id() and m.status = 'active' and r = any (m.roles);
$$;

-- Scope: (company, merchandiser) pairs whose workdays and visits I can see.
-- Myself · my team's merchandisers if I supervise · everyone if I am admin.
-- Used as an uncorrelated subquery: Postgres runs it once per query (hashed SubPlan).
create function private.visible_merchandisers() returns table (company_id uuid, merchandiser_id uuid)
language sql stable security definer rows 50 set search_path = '' as $$
  with me as (
    select m.company_id, m.roles, m.team_id
    from public.membership m
    where m.person_id = private.current_person_id() and m.status = 'active'
  )
  select me.company_id, private.current_person_id() from me where 'merchandiser' = any (me.roles)
  union
  select a.company_id, a.person_id
  from me join public.membership a on a.company_id = me.company_id
  where a.status = 'active' and 'merchandiser' = any (a.roles)
    and ('admin' = any (me.roles)
         or ('supervisor' = any (me.roles) and me.team_id is not null and a.team_id = me.team_id));
$$;

-- How may I edit this visit? 'merchandiser' (mine), 'supervisor' (in my scope, not mine) or null.
create function private.visit_role(p_visit uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
           when v.merchandiser_id = private.current_person_id() then 'merchandiser'
           when (v.company_id, v.merchandiser_id) in (select * from private.visible_merchandisers()) then 'supervisor'
         end
  from public.visit v where v.id = p_visit;
$$;

-- Workday: the merchandiser must belong to the company; created_by = whoever creates it.
create function private.workday_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.membership m
                   where m.company_id = new.company_id and m.person_id = new.merchandiser_id
                     and m.status = 'active' and 'merchandiser' = any (m.roles)) then
      raise exception 'Person is not an active merchandiser of this company' using errcode = '23514';
    end if;
    if me is not null then new.created_by := me; end if;
  else
    if new.company_id <> old.company_id or new.merchandiser_id <> old.merchandiser_id or new.created_by <> old.created_by then
      raise exception 'Company, merchandiser and creator of a workday are immutable' using errcode = '23514';
    end if;
    if new.work_date <> old.work_date and old.status <> 'draft' then
      raise exception 'Only a draft workday can change its date' using errcode = '23514';
    end if;
  end if;
  if new.status <> 'draft' and new.published_at is null then new.published_at := now(); end if;
  if new.status = 'draft' then new.published_at := null; end if;
  return new;
end $$;
create trigger guard before insert or update on public.workday for each row execute function private.workday_guard();

-- Visit on insert: copies merchandiser and date from the workday; sets source and author.
create function private.visit_on_create() returns trigger
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
    new.source := case when me = w.merchandiser_id then 'added' else 'assigned' end;
  end if;
  if new.resumed_from is not null then  -- resuming keeps the original source and author
    select o.source, o.added_by into new.source, new.added_by
    from public.visit o where o.id = new.resumed_from and o.company_id = new.company_id;
  end if;
  new.updated_by := me;
  return new;
end $$;
create trigger on_create before insert on public.visit for each row execute function private.visit_on_create();

-- Allowed work status transitions.
create function private.work_transition_is_valid(from_status public.work_status, to_status public.work_status) returns boolean
language sql immutable set search_path = '' as $$
  select from_status = to_status or (from_status, to_status) in (
    ('pending'::public.work_status, 'in_progress'::public.work_status),
    ('pending', 'closed'), ('pending', 'refused'),
    ('in_progress', 'done'), ('in_progress', 'refused'), ('in_progress', 'closed'), ('in_progress', 'pending'),
    ('closed', 'in_progress'),
    ('done', 'in_progress')
  );
$$;

-- Visit on update: immutable fields, who may change what, transitions and review.
create function private.visit_guard() returns trigger
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

  if not private.work_transition_is_valid(old.work_status, new.work_status) then
    raise exception 'Work status transition not allowed: % -> %', old.work_status, new.work_status using errcode = '23514';
  end if;

  if me is not null then
    acting := private.visit_role(old.id);
    if acting is null then
      raise exception 'No permission on this visit' using errcode = '42501';
    end if;

    if acting = 'merchandiser' then
      if old.review_status = 'approved' then
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
      if (new.work_status, new.arrived_at, new.consent, new.objection, new.notes, new.finished_at, new.retry_after)
         is distinct from
         (old.work_status, old.arrived_at, old.consent, old.objection, old.notes, old.finished_at, old.retry_after) then
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
create trigger guard before update on public.visit for each row execute function private.visit_guard();

-- Automatic history.
create function private.visit_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
begin
  if tg_op = 'INSERT' then
    insert into public.visit_event (company_id, visit_id, actor_id, kind, to_value)
    values (new.company_id, new.id, me,
            (case when new.resumed_from is null then 'created' else 'resumed' end)::public.visit_event_kind,
            new.source::text);
    return null;
  end if;
  if new.work_status <> old.work_status then
    insert into public.visit_event (company_id, visit_id, actor_id, kind, from_value, to_value)
    values (new.company_id, new.id, me, 'work', old.work_status::text, new.work_status::text);
  end if;
  if new.review_status <> old.review_status then
    insert into public.visit_event (company_id, visit_id, actor_id, kind, from_value, to_value)
    values (new.company_id, new.id, me, 'review', old.review_status::text, new.review_status::text);
  end if;
  if new.store_id <> old.store_id then
    insert into public.visit_event (company_id, visit_id, actor_id, kind)
    values (new.company_id, new.id, me, 'reassigned');
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    insert into public.visit_event (company_id, visit_id, actor_id, kind)
    values (new.company_id, new.id, me, 'deleted');
  end if;
  return null;
end $$;
create trigger history after insert or update on public.visit for each row execute function private.visit_history();

-- Visit children (display, photo, metric, brand): only someone who can edit the visit,
-- never on an approved visit. Photos and work are recorded by the merchandiser only.
create function private.visit_child_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me      uuid := private.current_person_id();
  vid     uuid;
  acting  text;
  review  public.review_status;
begin
  if me is null then  -- service_role (Edge Functions) or maintenance
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then vid := old.visit_id; else vid := new.visit_id; end if;
  if tg_op = 'UPDATE' and new.visit_id <> old.visit_id then
    raise exception 'A record cannot move to another visit' using errcode = '23514';
  end if;
  acting := private.visit_role(vid);
  if acting is null then
    raise exception 'No permission on this visit' using errcode = '42501';
  end if;
  select v.review_status into review from public.visit v where v.id = vid;
  if review = 'approved' then
    raise exception 'An approved visit is locked' using errcode = '42501';
  end if;
  if acting = 'supervisor' and tg_table_name in ('photo', 'visit_metric', 'visit_brand') then
    raise exception 'Photos and work are recorded by the merchandiser' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and tg_table_name = 'photo' then
    new.created_by := me;
    new.uploaded_at := null;  -- confirmed by the Edge Function after checking the file in R2
  elsif tg_op = 'INSERT' and tg_table_name = 'display' then
    new.created_by := me;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger guard before insert or update or delete on public.display      for each row execute function private.visit_child_guard();
create trigger guard before insert or update or delete on public.photo        for each row execute function private.visit_child_guard();
create trigger guard before insert or update or delete on public.visit_metric for each row execute function private.visit_child_guard();
create trigger guard before insert or update or delete on public.visit_brand  for each row execute function private.visit_child_guard();

-- Membership: a company always keeps one admin; only the invitee accepts an invitation.
create function private.membership_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'active' and 'admin' = any (old.roles)
     and (new.status <> 'active' or not ('admin' = any (new.roles)))
     and not exists (select 1 from public.membership m
                     where m.company_id = old.company_id and m.id <> old.id
                       and m.status = 'active' and 'admin' = any (m.roles)) then
    raise exception 'A company needs at least one active admin' using errcode = '23514';
  end if;
  if (new.company_id, new.person_id) is distinct from (old.company_id, old.person_id) then
    raise exception 'Company and person of a membership are immutable' using errcode = '23514';
  end if;
  if new.status = 'active' and old.status <> 'active'
     and private.current_person_id() is not null and private.current_person_id() <> old.person_id then
    raise exception 'Only the invited person can accept an invitation' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard before update on public.membership for each row execute function private.membership_guard();
