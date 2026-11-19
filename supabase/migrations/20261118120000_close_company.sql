-- A company's admin can close it. Closing is safe and reversible for 30 days:
--   * nothing is deleted: stores, visits, photos and people stay as they are;
--   * every active or invited membership is set to 'disabled', so nobody (admins included) can
--     see or change anything: every check already asks for an active membership;
--   * how each membership was is kept in company_closure, so reopening puts everything back;
--   * any admin it had can reopen it within 30 days (my_closed_companies, reopen_company);
--     after that, or any time, only Visitario (platform_reopen_company).
-- Closing asks for the company's name typed as it is, and a self-employed (personal) account
-- is not closed this way.

create table public.company_closure (
  company_id   uuid primary key references public.company (id) on delete cascade,
  closed_at    timestamptz not null default now(),
  closed_by    uuid not null references public.person (id) on delete restrict,
  reason       text check (char_length(reason) <= 300),
  reopen_until timestamptz not null,
  -- [{ "id": membership id, "status": as it was, "admin": had the admin role }]
  memberships  jsonb not null check (jsonb_typeof(memberships) = 'array')
);
comment on table public.company_closure is 'A closed company: who closed it, until when its admins can reopen it, and its memberships as they were.';

alter table public.company_closure enable row level security;
alter table public.company_closure force row level security;
-- Read through my_closed_companies() and the platform functions; written only by the RPCs below.
create policy company_closure_platform on public.company_closure for select to authenticated
  using ((select private.is_platform_admin()));
revoke all on public.company_closure from anon, authenticated;
grant select on public.company_closure to authenticated;

-- While closing, the company's last admin may be disabled too (only inside close_company).
create or replace function private.membership_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'active' and 'admin' = any (old.roles)
     and (new.status <> 'active' or not ('admin' = any (new.roles)))
     and coalesce(current_setting('visitario.closing', true), '') <> old.company_id::text
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

-- What closing would leave without access, to say it before.
create function public.company_close_preview(p_company uuid)
returns table (name text, kind public.company_kind, members integer, invited integer, stores integer, days_today integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_company not in (select private.companies_with_role('admin')) then
    raise exception 'Only the company admins' using errcode = '42501';
  end if;
  return query
  select c.name, c.kind,
         (select count(*)::int from public.membership m where m.company_id = c.id and m.status = 'active'),
         (select count(*)::int from public.membership m where m.company_id = c.id and m.status = 'invited'),
         (select count(*)::int from public.store s where s.company_id = c.id and s.deleted_at is null),
         (select count(*)::int from public.workday w
           where w.company_id = c.id and w.deleted_at is null and w.status = 'published'
             and w.work_date = (now() at time zone c.timezone)::date)
  from public.company c where c.id = p_company;
end $$;
revoke all on function public.company_close_preview(uuid) from public, anon;
grant execute on function public.company_close_preview(uuid) to authenticated;

create function public.close_company(p_company uuid, p_name text, p_reason text default null)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  c public.company%rowtype;
  me uuid := private.current_person_id();
  kept jsonb;
  until timestamptz := now() + interval '30 days';
begin
  if p_company not in (select private.companies_with_role('admin')) then
    raise exception 'Only the company admins' using errcode = '42501';
  end if;
  select * into c from public.company where id = p_company for update;
  if c.kind = 'personal' then
    raise exception 'A personal account is not closed this way' using errcode = '22023';
  end if;
  if lower(btrim(coalesce(p_name, ''))) <> lower(btrim(c.name)) then
    raise exception 'The name does not match' using errcode = '22023';
  end if;
  if exists (select 1 from public.company_closure where company_id = p_company) then
    raise exception 'Already closed' using errcode = '23505';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'status', m.status, 'admin', 'admin' = any (m.roles))), '[]')
    into kept
  from public.membership m where m.company_id = p_company and m.status in ('active', 'invited');

  insert into public.company_closure (company_id, closed_by, reason, reopen_until, memberships)
  values (p_company, me, nullif(btrim(left(p_reason, 300)), ''), until, kept);

  perform set_config('visitario.closing', p_company::text, true);
  update public.membership set status = 'disabled'
  where company_id = p_company and status in ('active', 'invited');
  perform set_config('visitario.closing', '', true);
  return until;
end $$;
revoke all on function public.close_company(uuid, text, text) from public, anon;
grant execute on function public.close_company(uuid, text, text) to authenticated;

-- Companies I was an admin of that are closed and I can still reopen.
create function public.my_closed_companies()
returns table (company_id uuid, name text, closed_at timestamptz, closed_by text, reopen_until timestamptz)
language sql stable security definer set search_path = '' as $$
  select k.company_id, c.name, k.closed_at, p.first_name || ' ' || p.last_name, k.reopen_until
  from public.company_closure k
  join public.company c on c.id = k.company_id
  join public.person p on p.id = k.closed_by
  where k.reopen_until > now()
    and exists (select 1 from jsonb_array_elements(k.memberships) e
                join public.membership m on m.id = (e ->> 'id')::uuid
                where (e ->> 'admin')::boolean and e ->> 'status' = 'active'
                  and m.person_id = private.current_person_id())
  order by k.closed_at desc;
$$;
revoke all on function public.my_closed_companies() from public, anon;
grant execute on function public.my_closed_companies() to authenticated;

-- Everything back as it was: memberships that are still disabled get their status again.
create function private.reopen(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  k public.company_closure%rowtype;
begin
  select * into k from public.company_closure where company_id = p_company for update;
  update public.membership m set status = (e ->> 'status')::public.membership_status
  from jsonb_array_elements(k.memberships) e
  where m.id = (e ->> 'id')::uuid and m.company_id = p_company and m.status = 'disabled';
  delete from public.company_closure where company_id = p_company;
end $$;

create function public.reopen_company(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_company not in (select k.company_id from public.my_closed_companies() k) then
    raise exception 'Not a closed company you can reopen' using errcode = '42501';
  end if;
  perform private.reopen(p_company);
end $$;
revoke all on function public.reopen_company(uuid) from public, anon;
grant execute on function public.reopen_company(uuid) to authenticated;

create function public.platform_reopen_company(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only Visitario admins' using errcode = '42501';
  end if;
  if not exists (select 1 from public.company_closure where company_id = p_company) then
    raise exception 'Not closed' using errcode = 'P0002';
  end if;
  perform private.reopen(p_company);
end $$;
revoke all on function public.platform_reopen_company(uuid) from public, anon;
grant execute on function public.platform_reopen_company(uuid) to authenticated;

-- The platform list says when a company was closed.
drop function public.platform_companies();
create function public.platform_companies()
returns table (
  id uuid, name text, kind public.company_kind, created_at timestamptz,
  plan public.plan_kind, status public.subscription_status, ends_on date,
  members integer, invited integer, admins text,
  visits_30d integer, last_activity_at timestamptz,
  photos integer, photo_bytes bigint,
  ai_captures integer, ai_cost_usd_thousandths integer,
  support_until timestamptz,
  ai_limit integer, ai_custom_limit integer,
  closed_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_month date := date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not private.is_platform_admin() then
    raise exception 'Only Visitario admins' using errcode = '42501';
  end if;
  return query
  select c.id, c.name, c.kind, c.created_at,
         s.plan, s.status, s.ends_on,
         (select count(*)::int from public.membership m where m.company_id = c.id and m.status = 'active'),
         (select count(*)::int from public.membership m where m.company_id = c.id and m.status = 'invited'),
         (select string_agg(p.first_name || ' ' || p.last_name, ', ' order by p.first_name)
            from public.membership m join public.person p on p.id = m.person_id
           where m.company_id = c.id and m.status in ('active', 'invited') and 'admin' = any (m.roles)),
         (select count(*)::int from public.visit v
           where v.company_id = c.id and v.deleted_at is null and v.work_date >= current_date - 30),
         (select max(v.updated_at) from public.visit v where v.company_id = c.id),
         (select count(*)::int from public.photo f where f.company_id = c.id and f.deleted_at is null),
         (select coalesce(sum(f.bytes), 0)::bigint from public.photo f where f.company_id = c.id and f.deleted_at is null),
         coalesce(u.captures, 0), coalesce(u.cost_usd_thousandths, 0),
         (select max(a.ends_at) from public.support_access a
           where a.company_id = c.id and a.admin_id = private.current_person_id() and a.ends_at > now()),
         private.ai_month_limit(c.id), s.ai_monthly_limit,
         (select k.closed_at from public.company_closure k where k.company_id = c.id)
  from public.company c
  left join public.subscription s on s.company_id = c.id
  left join public.ai_usage u on u.company_id = c.id and u.month = this_month
  order by c.kind = 'personal', c.created_at;
end $$;
revoke all on function public.platform_companies() from public, anon;
grant execute on function public.platform_companies() to authenticated;
