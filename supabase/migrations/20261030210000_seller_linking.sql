-- =============================================================================
-- A seller loaded by name (from a store, an import or the catalog) becomes the same
-- seller when that person joins Visitario, instead of a second one with their full name.
--
-- 1. Inviting: the admin can say who they are in the catalog ("Florencia Se"); accepting
--    links them to it, with all its stores.
-- 2. Without that, the automatic link also knows "first name + start of the surname"
--    ("Florencia Se" for Florencia Sereno), but only when exactly one seller fits.
-- 3. Duplicates can be merged: the stores of one seller move to the other, and the one
--    left goes inactive. The person, if any, stays with the one kept.
-- =============================================================================

-- ---- 1. The invitation remembers the seller chosen
alter table public.invitation add column seller_id integer,
  add foreign key (company_id, seller_id) references public.seller (company_id, id) on delete set null (seller_id);
comment on column public.invitation.seller_id is 'The catalog seller this person is (loaded by name before they joined); linked on accepting.';

drop function public.create_invitation(uuid, text, text, public.role[], uuid, date, text);
create function public.create_invitation(p_company uuid, p_dni text, p_email text, p_roles public.role[],
                                         p_team uuid, p_starts_on date, p_token text, p_seller integer default null)
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
  if p_seller is not null and (not ('seller' = any (p_roles)) or not exists (
       select 1 from public.seller s where s.id = p_seller and s.company_id = p_company and s.person_id is null)) then
    raise exception 'That seller is not free to link' using errcode = '23514';
  end if;
  -- Inviting again replaces the open invitation (and its link).
  update public.invitation set status = 'canceled', answered_at = now()
  where company_id = p_company and dni = p_dni and status = 'pending';
  insert into public.invitation (company_id, dni, email, roles, team_id, starts_on, token_hash, expires_at, invited_by, seller_id)
  values (p_company, p_dni, lower(btrim(p_email)), p_roles, p_team, coalesce(p_starts_on, current_date),
          private.token_hash(p_token), now() + interval '1 hour', private.current_person_id(), p_seller)
  returning id into iid;
  return private.invitation_mail(iid);
end $$;
revoke execute on function public.create_invitation from public, anon;
grant execute on function public.create_invitation to authenticated;

-- Accepting links the chosen seller first; then the membership's trigger finds it linked.
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
    if inv.seller_id is not null and 'seller' = any (inv.roles)
       and not exists (select 1 from public.seller s where s.company_id = inv.company_id and s.person_id = me) then
      update public.seller s set person_id = me, active = true
      where s.id = inv.seller_id and s.company_id = inv.company_id and s.person_id is null;
    end if;
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

-- ---- 2. The automatic link: full name, first name, or (only if one fits) first name + start of the surname
create or replace function private.link_seller() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  full_name text;
  first     text;
  last      text;
  sid       integer;
begin
  if new.status <> 'active' or not ('seller' = any (new.roles)) then return null; end if;
  if exists (select 1 from public.seller s where s.company_id = new.company_id and s.person_id = new.person_id) then
    update public.seller s set active = true where s.company_id = new.company_id and s.person_id = new.person_id and not s.active;
    return null;
  end if;
  select btrim(p.first_name || ' ' || p.last_name), p.first_name, p.last_name into full_name, first, last
  from public.person p where p.id = new.person_id;
  select s.id into sid from public.seller s
  where s.company_id = new.company_id and s.person_id is null
    and private.normalize(s.name) in (private.normalize(full_name), private.normalize(first))
  order by private.normalize(s.name) = private.normalize(full_name) desc, s.id
  limit 1;
  if sid is null then
    -- "Florencia Se" for Florencia Sereno: only when it is the one seller that fits.
    select min(s.id) into sid from public.seller s
    where s.company_id = new.company_id and s.person_id is null
      and private.normalize(s.name) like private.normalize(first) || ' _%'
      and starts_with(private.normalize(last), substr(private.normalize(s.name), char_length(private.normalize(first)) + 2))
    having count(*) = 1;
  end if;
  if sid is not null then
    update public.seller s set person_id = new.person_id, active = true where s.id = sid;
  else
    insert into public.seller (company_id, name, person_id)
    values (new.company_id, left(full_name, 80), new.person_id)
    on conflict do nothing;
  end if;
  return null;
end $$;

-- ---- 3. Merging two sellers of a company: one stays with every store
create function public.merge_sellers(p_keep integer, p_drop integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  keep public.seller%rowtype;
  dropped public.seller%rowtype;
  moved integer;
begin
  select * into keep from public.seller where id = p_keep;
  select * into dropped from public.seller where id = p_drop;
  if keep.id is null or dropped.id is null or keep.company_id <> dropped.company_id or keep.id = dropped.id
     or keep.company_id not in (select private.companies_with_role('admin')) then
    raise exception 'Only an admin merges two sellers of the company' using errcode = '42501';
  end if;
  if keep.person_id is not null and dropped.person_id is not null then
    raise exception 'Both sellers have a Visitario user' using errcode = '23514';
  end if;
  update public.store set seller_id = keep.id where company_id = keep.company_id and seller_id = dropped.id;
  get diagnostics moved = row_count;
  -- The person, if the one going away had it, comes with its stores.
  if dropped.person_id is not null then
    update public.seller set person_id = null where id = dropped.id;
    update public.seller set person_id = dropped.person_id where id = keep.id;
  end if;
  update public.seller set active = false where id = dropped.id;
  update public.seller set active = true where id = keep.id;
  return moved;
end $$;
revoke execute on function public.merge_sellers(integer, integer) from public, anon;
grant execute on function public.merge_sellers(integer, integer) to authenticated;
