-- =============================================================================
-- Visitario v2 · Initial schema (4/4): public functions (RPC), views, maintenance
-- RPCs do what no direct policy allows, with their own checks.
-- =============================================================================

-- Onboarding: creates my person, or claims the one a company created when inviting me.
-- Claiming an existing DNI requires the session's verified phone to match the one on file.
create function public.complete_identity(p_dni text, p_first_name text, p_last_name text,
                                         p_birth_date date, p_phone text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  existing uuid;
  session_phone text := nullif(regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '[^0-9]', '', 'g'), '');
  pid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if private.current_person_id() is not null then raise exception 'Identity already completed' using errcode = '23505'; end if;

  select person_id into existing from public.person_private where dni = p_dni;
  if existing is not null then
    if exists (select 1 from public.person where id = existing and auth_user_id is not null) then
      raise exception 'This DNI already has an account' using errcode = '23505';
    end if;
    if session_phone is null
       or session_phone <> regexp_replace((select phone from public.person_private where person_id = existing), '[^0-9]', '', 'g') then
      raise exception 'Verify the phone number your company registered' using errcode = '42501';
    end if;
    update public.person set auth_user_id = auth.uid(), first_name = p_first_name, last_name = p_last_name where id = existing;
    update public.person_private set birth_date = p_birth_date, phone_verified_at = now() where person_id = existing;
    return existing;
  end if;

  insert into public.person (auth_user_id, first_name, last_name) values (auth.uid(), p_first_name, p_last_name) returning id into pid;
  insert into public.person_private (person_id, dni, birth_date, phone, phone_verified_at)
  values (pid, p_dni, p_birth_date, p_phone,
          case when session_phone is not null and session_phone = regexp_replace(p_phone, '[^0-9]', '', 'g') then now() end);
  return pid;
end $$;

-- Self-employed mode: my personal company (one per person) with base catalogs.
create function public.create_personal_company() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  cid uuid;
begin
  if me is null then raise exception 'Complete your identity first' using errcode = '42501'; end if;
  select id into cid from public.company where owner_person_id = me and kind = 'personal';
  if cid is not null then return cid; end if;
  insert into public.company (name, kind, owner_person_id)
  values ((select first_name || ' · uso propio' from public.person where id = me), 'personal', me) returning id into cid;
  insert into public.subscription (company_id, plan) values (cid, 'free');
  insert into public.membership (company_id, person_id, roles, status) values (cid, me, '{merchandiser,admin}', 'active');
  insert into public.display_type (company_id, name, sort_order)
  values (cid, 'Puntera', 1), (cid, 'Góndola', 2), (cid, 'Isla', 3), (cid, 'Otra', 9);
  return cid;
end $$;

-- DNI lookup to onboard someone. Admins only; 30 per hour; logged with a hash.
create function public.find_person_by_dni(p_company uuid, p_dni text)
returns table (person_id uuid, first_name text, last_name text, phone_last4 text, is_member boolean)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  pid uuid;
begin
  if p_company not in (select private.companies_with_role('admin')) then
    raise exception 'Only a company admin can search by DNI' using errcode = '42501';
  end if;
  if (select count(*) from public.dni_lookup l where l.searched_by = me and l.searched_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many lookups; try again later' using errcode = '53400';
  end if;
  select pp.person_id into pid from public.person_private pp where pp.dni = p_dni;
  insert into public.dni_lookup (company_id, searched_by, dni_hash, found)
  values (p_company, me, sha256(convert_to(p_dni, 'UTF8')), pid is not null);
  return query
    select p.id, p.first_name, p.last_name, right(pp.phone, 4),
           exists (select 1 from public.membership m where m.company_id = p_company and m.person_id = p.id)
    from public.person p join public.person_private pp on pp.person_id = p.id
    where p.id = pid;
end $$;

-- Invite: creates the person if needed (minimal data) and an invited membership.
create function public.invite_person(p_company uuid, p_dni text, p_roles public.role[], p_team uuid,
                                     p_starts_on date, p_first_name text default null, p_last_name text default null,
                                     p_phone text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  pid uuid;
  mid uuid;
begin
  if p_company not in (select private.companies_with_role('admin')) then
    raise exception 'Only an admin can invite' using errcode = '42501';
  end if;
  if (select kind from public.company where id = p_company) = 'personal' then
    raise exception 'A personal company cannot invite' using errcode = '23514';
  end if;
  select person_id into pid from public.person_private where dni = p_dni;
  if pid is null then
    if p_first_name is null or p_last_name is null or p_phone is null then
      raise exception 'A new DNI needs first name, last name and phone' using errcode = '23502';
    end if;
    insert into public.person (first_name, last_name) values (p_first_name, p_last_name) returning id into pid;
    insert into public.person_private (person_id, dni, phone) values (pid, p_dni, p_phone);
  end if;
  insert into public.membership (company_id, person_id, roles, team_id, status, starts_on, invited_by)
  values (p_company, pid, p_roles, p_team, 'invited', coalesce(p_starts_on, current_date), me)
  on conflict (company_id, person_id) do update
    set roles = excluded.roles, team_id = excluded.team_id, starts_on = excluded.starts_on,
        status = case when public.membership.status in ('declined', 'disabled') then 'invited' else public.membership.status end
  returning id into mid;
  return mid;
end $$;

create function public.respond_invitation(p_membership uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.membership set status = case when p_accept then 'active'::public.membership_status else 'declined' end
  where id = p_membership and person_id = private.current_person_id() and status = 'invited';
  if not found then raise exception 'Invitation not found' using errcode = 'P0002'; end if;
end $$;

-- Resume: creates a new visit in my workday from an earlier pending or closed one.
create function public.resume_visit(p_visit uuid, p_workday uuid, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o public.visit%rowtype;
  nid uuid := coalesce(p_id, private.uuid_v7());
begin
  select * into o from public.visit where id = p_visit;
  if not found or private.visit_role(p_visit) is null then
    raise exception 'Visit not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.workday w
                 where w.id = p_workday and w.company_id = o.company_id and w.deleted_at is null
                   and (w.company_id, w.merchandiser_id) in (select * from private.visible_merchandisers())) then
    raise exception 'Workday not found' using errcode = 'P0002';
  end if;
  if o.work_status not in ('pending', 'closed') then
    raise exception 'Only pending or closed visits can be resumed' using errcode = '23514';
  end if;
  insert into public.visit (id, company_id, workday_id, merchandiser_id, work_date, store_id, task, source, added_by, resumed_from)
  values (nid, o.company_id, p_workday, o.merchandiser_id, o.work_date, o.store_id, o.task, o.source, o.added_by, o.id)
  on conflict (id) do nothing;
  insert into public.display (company_id, visit_id, display_type_id, reference, sort_order)
  select d.company_id, nid, d.display_type_id, d.reference, d.sort_order
  from public.display d
  where d.visit_id = o.id and d.deleted_at is null
    and not exists (select 1 from public.photo f where f.display_id = d.id and f.kind = 'after' and f.deleted_at is null)
    and not exists (select 1 from public.display x where x.visit_id = nid);
  return nid;
end $$;

revoke all on function public.complete_identity, public.create_personal_company, public.find_person_by_dni,
                       public.invite_person, public.respond_invitation, public.resume_visit from public, anon;
grant execute on function public.complete_identity, public.create_personal_company, public.find_person_by_dni,
                          public.invite_person, public.respond_invitation, public.resume_visit to authenticated;

-- -----------------------------------------------------------------------------
-- Read views (security_invoker: they apply the caller's RLS)
-- -----------------------------------------------------------------------------

-- Display with its derived state.
create view public.display_status with (security_invoker = true) as
select d.*,
       exists (select 1 from public.photo f where f.display_id = d.id and f.kind = 'after' and f.deleted_at is null) as arranged
from public.display d
where d.deleted_at is null;

-- Daily progress per merchandiser (dashboard and reports). "Visited" = any result.
create view public.daily_progress with (security_invoker = true) as
select v.company_id, v.work_date, v.merchandiser_id,
       count(*)                                                             as total,
       count(*) filter (where v.work_status in ('done', 'refused', 'closed')) as visited,
       count(*) filter (where v.work_status = 'done')                       as done,
       count(*) filter (where v.work_status = 'refused')                    as refused,
       count(*) filter (where v.work_status = 'closed')                     as closed,
       count(*) filter (where v.review_status = 'approved')                 as approved,
       count(*) filter (where v.review_status = 'needs_fix')                as needs_fix,
       count(*) filter (where v.source = 'added')                           as added,
       max(v.updated_at)                                                    as last_activity_at
from public.visit v
where v.deleted_at is null
group by v.company_id, v.work_date, v.merchandiser_id;

-- Work totals per day and merchandiser (daily report).
create view public.daily_metrics with (security_invoker = true) as
select v.company_id, v.work_date, v.merchandiser_id, m.metric_id, sum(m.quantity)::integer as quantity
from public.visit v join public.visit_metric m on m.visit_id = v.id
where v.deleted_at is null
group by v.company_id, v.work_date, v.merchandiser_id, m.metric_id;

-- Supabase grants everything to anon and authenticated by default: views are read-only, no anon.
revoke all on public.display_status, public.daily_progress, public.daily_metrics from anon, authenticated;
grant select on public.display_status, public.daily_progress, public.daily_metrics to authenticated;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.uuid_v7, private.normalize, private.current_person_id, private.is_platform_admin,
                          private.my_companies, private.companies_with_role, private.visible_merchandisers,
                          private.visit_role to authenticated;
grant execute on all functions in schema private to service_role;
