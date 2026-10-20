-- =============================================================================
-- Invitations are accepted by email, not by DNI: the account that accepts must have
-- the email the invitation was sent to (the link already proves it reached that inbox).
-- The DNI the admin typed stays on the invitation (one open per DNI, "already a member"),
-- but it no longer has to match the profile's.
-- =============================================================================

-- The email of the signed-in account, lowercase (auth.users, not only the JWT claim).
create function private.session_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(nullif(btrim(u.email), '')) from auth.users u where u.id = auth.uid();
$$;
revoke all on function private.session_email from public, anon;
grant execute on function private.session_email to authenticated;

create or replace function public.invitation_preview(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  inv public.invitation%rowtype;
begin
  select * into inv from public.invitation where token_hash = private.token_hash(coalesce(p_token, ''));
  if not found then return jsonb_build_object('state', 'invalid'); end if;
  return private.invitation_mail(inv.id) - 'id' || jsonb_build_object(
    'state', case when inv.status <> 'pending' then inv.status::text when inv.expires_at <= now() then 'expired' else 'pending' end,
    'dni_end', right(inv.dni, 3),
    'has_account', exists (select 1 from auth.users u where lower(u.email) = inv.email));
end $$;

-- Accept or decline, by link (token) or from the profile (id), with the invited email's account.
create or replace function private.answer_invitation(inv public.invitation, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
begin
  if me is null then raise exception 'Complete your identity first' using errcode = '42501'; end if;
  if inv.id is null then raise exception 'Invitation not found' using errcode = 'P0002'; end if;
  if inv.status <> 'pending' then raise exception 'The invitation was already answered' using errcode = '23514'; end if;
  if inv.expires_at <= now() then raise exception 'The invitation expired' using errcode = '23514'; end if;
  if private.session_email() is distinct from inv.email then
    raise exception 'This invitation is for another email' using errcode = '42501';
  end if;
  if p_accept then
    insert into public.membership (company_id, person_id, roles, team_id, status, starts_on, invited_by)
    values (inv.company_id, me, inv.roles, inv.team_id, 'active', inv.starts_on, inv.invited_by)
    on conflict (company_id, person_id) do update
      set roles = excluded.roles, team_id = excluded.team_id, starts_on = excluded.starts_on, status = 'active';
  end if;
  update public.invitation
  set status = case when p_accept then 'accepted'::public.invitation_status else 'declined' end,
      accepted_by = case when p_accept then me end, answered_at = now()
  where id = inv.id;
  return jsonb_build_object('company_id', inv.company_id, 'roles', inv.roles,
                            'company', (select name from public.company where id = inv.company_id));
end $$;

-- Open invitations for my account's email (the profile shows them even without the link).
create or replace function public.my_invitations()
returns table (id uuid, company text, roles public.role[], starts_on date, expires_at timestamptz, inviter text)
language sql stable security definer set search_path = '' as $$
  select i.id, c.name, i.roles, i.starts_on, i.expires_at,
         (select p.first_name || ' ' || p.last_name from public.person p where p.id = i.invited_by)
  from public.invitation i
  join public.company c on c.id = i.company_id
  where i.email = private.session_email() and private.current_person_id() is not null
    and i.status = 'pending' and i.expires_at > now()
  order by i.created_at;
$$;
