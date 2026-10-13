-- =============================================================================
-- Stage 5 · Admin: people and teams. Invitations already exist (find_person_by_dni,
-- invite_person, respond_invitation); this adds the admin's list of people and lets
-- an admin bring back someone they had deactivated.
-- =============================================================================

create index visit_event_actor on public.visit_event (company_id, actor_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Everyone with a membership in the company, for its admins: roles, team, state,
-- the last four digits of the phone and when they last did something there.
-- The company never sees what the person does in other companies.
-- -----------------------------------------------------------------------------
create function public.company_people(p_company uuid)
returns table (membership_id uuid, person_id uuid, first_name text, last_name text, roles public.role[],
               team_id uuid, status public.membership_status, starts_on date, phone_last4 text,
               last_activity_at timestamptz, invited_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_company not in (select private.companies_with_role('admin')) then
    raise exception 'Only a company admin can list its people' using errcode = '42501';
  end if;
  return query
    select m.id, p.id, p.first_name, p.last_name, m.roles, m.team_id, m.status, m.starts_on, right(pp.phone, 4),
           (select e.occurred_at from public.visit_event e
            where e.company_id = p_company and e.actor_id = p.id
            order by e.occurred_at desc limit 1),
           m.created_at
    from public.membership m
    join public.person p on p.id = m.person_id
    left join public.person_private pp on pp.person_id = p.id
    where m.company_id = p_company
    order by p.first_name, p.last_name;
end $$;

revoke all on function public.company_people from public, anon;
grant execute on function public.company_people to authenticated;

-- -----------------------------------------------------------------------------
-- Membership guard: only the invitee accepts an invitation, but an admin can bring
-- back someone who was active before (disabled → active) without a new invitation.
-- -----------------------------------------------------------------------------
create or replace function private.membership_guard() returns trigger
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
  if new.status = 'active' and old.status in ('invited', 'declined')
     and private.current_person_id() is not null and private.current_person_id() <> old.person_id then
    raise exception 'Only the invited person can accept an invitation' using errcode = '42501';
  end if;
  return new;
end $$;
