-- =============================================================================
-- When someone accepts an invitation, the admin who invited them gets an email.
-- The app asks the invitation function to send it right after accepting; the function
-- (service role) takes the notices still owed to that account here, once each.
-- Without an inviter with email (removed, or signed in by phone) the company's active
-- admins are told instead.
-- =============================================================================

alter table public.invitation add column accept_notified_at timestamptz;

create function public.take_acceptance_notices(p_auth_user uuid)
returns table (
  invitation_id uuid,
  company       text,
  person_first  text,
  person_last   text,
  person_email  text,
  roles         public.role[],
  team          text,
  starts_on     date,
  inviter_first text,
  -- True when it goes to the inviter; false when to the company's other admins.
  to_inviter    boolean,
  recipients    text[]
)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with mine as (
    update public.invitation i
    set accept_notified_at = now()
    from public.person p
    where p.auth_user_id = p_auth_user
      and i.accepted_by = p.id
      and i.status = 'accepted'
      and i.accept_notified_at is null
      and i.answered_at > now() - interval '1 day'
    returning i.*
  )
  select m.id, c.name, p.first_name, p.last_name, m.email, m.roles, t.name, m.starts_on,
         inv.first_name,
         own.email is not null,
         case when own.email is not null then array[own.email]
              else coalesce((select array_agg(distinct lower(u.email)) from public.membership a
                               join public.person ap on ap.id = a.person_id
                               join auth.users u on u.id = ap.auth_user_id
                              where a.company_id = m.company_id and a.status = 'active' and 'admin' = any (a.roles)
                                and a.person_id <> m.accepted_by and nullif(btrim(u.email), '') is not null), '{}') end
  from mine m
  join public.company c on c.id = m.company_id
  join public.person p on p.id = m.accepted_by
  left join public.team t on t.id = m.team_id
  left join public.person inv on inv.id = m.invited_by
  left join lateral (select lower(u.email) email from auth.users u
                     where u.id = inv.auth_user_id and nullif(btrim(u.email), '') is not null) own on true;
end $$;

-- Only the invitation function (service role) takes them: an admin's email is not for the invited.
revoke all on function public.take_acceptance_notices(uuid) from public, anon, authenticated;
grant execute on function public.take_acceptance_notices(uuid) to service_role;
