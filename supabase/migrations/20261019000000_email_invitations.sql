-- Invitations by email: an admin invites by DNI + email; the person gets a link with a
-- one-time token that lasts 1 hour, completes their profile if they have none, and accepts.
-- Only the token's SHA-256 is stored. The membership is created on acceptance, when the
-- signed-in person's DNI matches the invited one (no placeholder people any more).

create type public.invitation_status as enum ('pending', 'accepted', 'declined', 'canceled');

create table public.invitation (
  id           uuid primary key default private.uuid_v7(),
  company_id   uuid not null references public.company (id) on delete cascade,
  dni          text not null check (dni ~ '^[0-9]{7,8}$'),
  email        text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  roles        public.role[] not null check (cardinality(roles) between 1 and 3 and array_position(roles, null) is null),
  team_id      uuid,
  starts_on    date not null default current_date,
  token_hash   text not null unique,
  expires_at   timestamptz not null,
  status       public.invitation_status not null default 'pending',
  invited_by   uuid references public.person (id) on delete set null,
  sends        smallint not null default 1,
  sent_at      timestamptz,
  send_error   text check (char_length(send_error) <= 200),
  accepted_by  uuid references public.person (id) on delete set null,
  answered_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1,
  foreign key (company_id, team_id) references public.team (company_id, id) on delete set null (team_id)
);
-- One open invitation per DNI and company: inviting again replaces it.
create unique index invitation_one_open on public.invitation (company_id, dni) where status = 'pending';
create index invitation_by_dni on public.invitation (dni) where status = 'pending';

alter table public.invitation enable row level security;
alter table public.invitation force row level security;
create policy invitation_admin_select on public.invitation for select to authenticated
  using (company_id in (select private.companies_with_role('admin')) or (select private.is_platform_admin()));
grant select on public.invitation to authenticated;

create trigger touch before insert or update on public.invitation for each row execute function private.touch();

-- The token's fingerprint, the only thing stored.
create function private.token_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(pg_catalog.sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- Who may invite into a company: its admins, and Visitario's.
create function private.can_invite(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_company in (select private.companies_with_role('admin')) or private.is_platform_admin();
$$;

-- What the email says: company, who invites, roles, when it expires, and to whom.
create function private.invitation_mail(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', i.id, 'email', i.email, 'roles', i.roles, 'expires_at', i.expires_at,
    'company', c.name,
    'inviter', coalesce((select p.first_name || ' ' || p.last_name from public.person p where p.id = i.invited_by), 'Visitario'))
  from public.invitation i join public.company c on c.id = i.company_id
  where i.id = p_id;
$$;

-- -----------------------------------------------------------------------------
-- Admin side
-- -----------------------------------------------------------------------------
create function public.create_invitation(p_company uuid, p_dni text, p_email text, p_roles public.role[],
                                         p_team uuid, p_starts_on date, p_token text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  iid uuid;
begin
  if not private.can_invite(p_company) then
    raise exception 'Only an admin can invite' using errcode = '42501';
  end if;
  if (select kind from public.company where id = p_company) = 'personal' then
    raise exception 'A personal company cannot invite' using errcode = '23514';
  end if;
  if char_length(coalesce(p_token, '')) < 32 then
    raise exception 'Token too short' using errcode = '22023';
  end if;
  if exists (select 1 from public.membership m join public.person_private pp on pp.person_id = m.person_id
             where m.company_id = p_company and pp.dni = p_dni and m.status = 'active') then
    raise exception 'Already a member of this company' using errcode = '23505';
  end if;
  -- Inviting again replaces the open invitation (and its link).
  update public.invitation set status = 'canceled', answered_at = now()
  where company_id = p_company and dni = p_dni and status = 'pending';
  insert into public.invitation (company_id, dni, email, roles, team_id, starts_on, token_hash, expires_at, invited_by)
  values (p_company, p_dni, lower(btrim(p_email)), p_roles, p_team, coalesce(p_starts_on, current_date),
          private.token_hash(p_token), now() + interval '1 hour', private.current_person_id())
  returning id into iid;
  return private.invitation_mail(iid);
end $$;

-- A new link and a new hour, for an open or expired invitation.
create function public.resend_invitation(p_invitation uuid, p_token text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitation%rowtype;
begin
  select * into inv from public.invitation where id = p_invitation;
  if not found or not private.can_invite(inv.company_id) then
    raise exception 'Only an admin can invite' using errcode = '42501';
  end if;
  if inv.status <> 'pending' then
    raise exception 'The invitation was already answered' using errcode = '23514';
  end if;
  if char_length(coalesce(p_token, '')) < 32 then
    raise exception 'Token too short' using errcode = '22023';
  end if;
  update public.invitation
  set token_hash = private.token_hash(p_token), expires_at = now() + interval '1 hour',
      sends = sends + 1, sent_at = null, send_error = null, invited_by = coalesce(private.current_person_id(), invited_by)
  where id = p_invitation;
  return private.invitation_mail(p_invitation);
end $$;

-- Whether the email went out (the Edge Function reports it).
create function public.mark_invitation_sent(p_invitation uuid, p_error text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_invite((select company_id from public.invitation where id = p_invitation)) then
    raise exception 'Only an admin can invite' using errcode = '42501';
  end if;
  update public.invitation
  set sent_at = case when p_error is null then now() end, send_error = left(p_error, 200)
  where id = p_invitation;
end $$;

create function public.cancel_invitation(p_invitation uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_invite((select company_id from public.invitation where id = p_invitation)) then
    raise exception 'Only an admin can invite' using errcode = '42501';
  end if;
  update public.invitation set status = 'canceled', answered_at = now() where id = p_invitation and status = 'pending';
end $$;

-- -----------------------------------------------------------------------------
-- Invited side
-- -----------------------------------------------------------------------------

-- What the link shows, before signing in: anyone holding the token may see it.
create function public.invitation_preview(p_token text)
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
    'has_account', exists (select 1 from auth.users u where lower(u.email) = inv.email)
                   or exists (select 1 from public.person_private pp join public.person p on p.id = pp.person_id
                              where pp.dni = inv.dni and p.auth_user_id is not null));
end $$;

-- Accept or decline, by link (token) or from the profile (id), as the invited DNI.
create function private.answer_invitation(inv public.invitation, p_accept boolean)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  my_dni text;
begin
  if me is null then raise exception 'Complete your identity first' using errcode = '42501'; end if;
  if inv.id is null then raise exception 'Invitation not found' using errcode = 'P0002'; end if;
  if inv.status <> 'pending' then raise exception 'The invitation was already answered' using errcode = '23514'; end if;
  if inv.expires_at <= now() then raise exception 'The invitation expired' using errcode = '23514'; end if;
  select dni into my_dni from public.person_private where person_id = me;
  if my_dni is distinct from inv.dni then
    raise exception 'This invitation is for another DNI' using errcode = '42501';
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

create function public.accept_invitation(p_token text default null, p_invitation uuid default null, p_accept boolean default true)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invitation%rowtype;
begin
  if p_token is not null then
    select * into inv from public.invitation where token_hash = private.token_hash(p_token);
  else
    select * into inv from public.invitation where id = p_invitation;
  end if;
  return private.answer_invitation(inv, p_accept);
end $$;

-- Open invitations for my DNI (the profile shows them even without the email).
create function public.my_invitations()
returns table (id uuid, company text, roles public.role[], starts_on date, expires_at timestamptz, inviter text)
language sql stable security definer set search_path = '' as $$
  select i.id, c.name, i.roles, i.starts_on, i.expires_at,
         (select p.first_name || ' ' || p.last_name from public.person p where p.id = i.invited_by)
  from public.invitation i
  join public.company c on c.id = i.company_id
  join public.person_private pp on pp.dni = i.dni and pp.person_id = private.current_person_id()
  where i.status = 'pending' and i.expires_at > now()
  order by i.created_at;
$$;

-- -----------------------------------------------------------------------------
-- Identity: a person invited by email may claim a DNI an admin loaded before (the old
-- invite_person placeholders) with the invitation instead of a verified phone.
-- Same function as before plus that one condition.
-- -----------------------------------------------------------------------------
create or replace function public.complete_identity(p_dni text, p_first_name text, p_last_name text,
                                                    p_birth_date date, p_phone text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  existing uuid;
  session_phone text := nullif(regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '[^0-9]', '', 'g'), '');
  session_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  pid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if private.current_person_id() is not null then raise exception 'Identity already completed' using errcode = '23505'; end if;

  select person_id into existing from public.person_private where dni = p_dni;
  if existing is not null then
    if exists (select 1 from public.person where id = existing and auth_user_id is not null) then
      raise exception 'This DNI already has an account' using errcode = '23505';
    end if;
    if not exists (select 1 from public.invitation i
                   where i.dni = p_dni and i.status = 'pending' and i.expires_at > now() and i.email = session_email)
       and (session_phone is null
            or session_phone <> regexp_replace((select phone from public.person_private where person_id = existing), '[^0-9]', '', 'g')) then
      raise exception 'Verify the phone number your company registered' using errcode = '42501';
    end if;
    update public.person set auth_user_id = auth.uid(), first_name = p_first_name, last_name = p_last_name where id = existing;
    update public.person_private set birth_date = p_birth_date, phone = p_phone, phone_verified_at = now() where person_id = existing;
    return existing;
  end if;

  insert into public.person (auth_user_id, first_name, last_name) values (auth.uid(), p_first_name, p_last_name) returning id into pid;
  insert into public.person_private (person_id, dni, birth_date, phone, phone_verified_at)
  values (pid, p_dni, p_birth_date, p_phone,
          case when session_phone is not null and session_phone = regexp_replace(p_phone, '[^0-9]', '', 'g') then now() end);
  return pid;
end $$;

-- Super admin: a company without anyone yet; its first admin gets an email invitation.
create function public.platform_new_company(p_name text, p_kind public.company_kind, p_plan public.plan_kind, p_ends_on date)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Only Visitario admins' using errcode = '42501';
  end if;
  if p_kind = 'personal' then
    raise exception 'Personal spaces are created by each person' using errcode = '23514';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'A company needs a name' using errcode = '23502';
  end if;
  if exists (select 1 from public.company c where c.kind <> 'personal' and lower(c.name) = lower(btrim(p_name))) then
    raise exception 'A company with that name already exists' using errcode = '23505';
  end if;
  insert into public.company (name, kind) values (btrim(p_name), p_kind) returning id into cid;
  insert into public.subscription (company_id, plan, ends_on) values (cid, p_plan, p_ends_on);
  insert into public.display_type (company_id, name, sort_order)
  values (cid, 'Puntera', 1), (cid, 'Góndola', 2), (cid, 'Isla', 3), (cid, 'Otra', 9);
  return cid;
end $$;

revoke execute on function public.create_invitation, public.resend_invitation, public.mark_invitation_sent,
  public.cancel_invitation, public.accept_invitation, public.my_invitations, public.platform_new_company from public, anon;
grant execute on function public.create_invitation, public.resend_invitation, public.mark_invitation_sent,
  public.cancel_invitation, public.accept_invitation, public.my_invitations, public.platform_new_company to authenticated;
-- The link's page asks before anyone signs in.
revoke execute on function public.invitation_preview from public;
grant execute on function public.invitation_preview to anon, authenticated;
