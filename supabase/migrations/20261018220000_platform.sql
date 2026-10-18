-- Super admin (Visitario's own panel, wireframes D05 / DM06).
-- Every function checks private.is_platform_admin(): nobody else can call them usefully.
-- Support is read-only by construction: support_company() only reads, and only while the
-- platform admin has an open support session for that company, started with a reason and
-- kept in support_access (which the company's admins can see).

-- -----------------------------------------------------------------------------
-- Companies with their plan and usage
-- -----------------------------------------------------------------------------
create function public.platform_companies()
returns table (
  id uuid, name text, kind public.company_kind, created_at timestamptz,
  plan public.plan_kind, status public.subscription_status, ends_on date,
  members integer, invited integer, admins text,
  visits_30d integer, last_activity_at timestamptz,
  photos integer, photo_bytes bigint,
  ai_captures integer, ai_cost_usd_thousandths integer,
  support_until timestamptz
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
           where a.company_id = c.id and a.admin_id = private.current_person_id() and a.ends_at > now())
  from public.company c
  left join public.subscription s on s.company_id = c.id
  left join public.ai_usage u on u.company_id = c.id and u.month = this_month
  order by c.kind = 'personal', c.created_at;
end $$;

-- The platform at a glance: people, storage and AI this month.
create function public.platform_totals()
returns table (active_people integer, photos integer, photo_bytes bigint, db_bytes bigint, ai_captures integer, ai_cost_usd_thousandths integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  this_month date := date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if not private.is_platform_admin() then
    raise exception 'Only Visitario admins' using errcode = '42501';
  end if;
  return query
  select (select count(distinct m.person_id)::int from public.membership m where m.status = 'active'),
         (select count(*)::int from public.photo f where f.deleted_at is null),
         (select coalesce(sum(f.bytes), 0)::bigint from public.photo f where f.deleted_at is null),
         pg_catalog.pg_database_size(pg_catalog.current_database())::bigint,
         (select coalesce(sum(u.captures), 0)::int from public.ai_usage u where u.month = this_month),
         (select coalesce(sum(u.cost_usd_thousandths), 0)::int from public.ai_usage u where u.month = this_month);
end $$;

-- -----------------------------------------------------------------------------
-- A new company with its first admin, invited by DNI (as admins invite people)
-- -----------------------------------------------------------------------------
create function public.platform_create_company(
  p_name text, p_kind public.company_kind, p_plan public.plan_kind, p_ends_on date,
  p_admin_dni text, p_first_name text default null, p_last_name text default null, p_phone text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  cid uuid;
  pid uuid;
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
  if p_admin_dni !~ '^[0-9]{7,8}$' then
    raise exception 'The DNI has 7 or 8 digits' using errcode = '23514';
  end if;

  insert into public.company (name, kind) values (btrim(p_name), p_kind) returning id into cid;
  insert into public.subscription (company_id, plan, ends_on) values (cid, p_plan, p_ends_on);
  insert into public.display_type (company_id, name, sort_order)
  values (cid, 'Puntera', 1), (cid, 'Góndola', 2), (cid, 'Isla', 3), (cid, 'Otra', 9);

  select pp.person_id into pid from public.person_private pp where pp.dni = p_admin_dni;
  if pid is null then
    if nullif(btrim(p_first_name), '') is null or nullif(btrim(p_last_name), '') is null or p_phone is null then
      raise exception 'A new DNI needs first name, last name and phone' using errcode = '23502';
    end if;
    insert into public.person (first_name, last_name) values (btrim(p_first_name), btrim(p_last_name)) returning id into pid;
    insert into public.person_private (person_id, dni, phone) values (pid, p_admin_dni, p_phone);
  end if;
  insert into public.membership (company_id, person_id, roles, status, invited_by)
  values (cid, pid, '{admin}', 'invited', me);
  return cid;
end $$;

-- Plan, state and end date of a company's subscription.
create function public.platform_set_plan(p_company uuid, p_plan public.plan_kind, p_status public.subscription_status, p_ends_on date)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only Visitario admins' using errcode = '42501';
  end if;
  if (select kind from public.company where id = p_company) = 'personal' and p_plan <> 'free' then
    raise exception 'A personal space stays on the free plan' using errcode = '23514';
  end if;
  insert into public.subscription (company_id, plan, status, ends_on) values (p_company, p_plan, p_status, p_ends_on)
  on conflict (company_id) do update set plan = excluded.plan, status = excluded.status, ends_on = excluded.ends_on, updated_at = now();
end $$;

-- -----------------------------------------------------------------------------
-- Support: a session with a reason (2 hours), then a read-only look at the company
-- -----------------------------------------------------------------------------
create function public.start_support(p_company uuid, p_reason text)
returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  until timestamptz;
begin
  if not private.is_platform_admin() then
    raise exception 'Only Visitario admins' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Say why, in at least 10 characters' using errcode = '23514';
  end if;
  insert into public.support_access (company_id, admin_id, reason)
  values (p_company, me, btrim(p_reason)) returning ends_at into until;
  return until;
end $$;

create function public.support_company(p_company uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  result jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'Only Visitario admins' using errcode = '42501';
  end if;
  if not exists (select 1 from public.support_access a
                 where a.company_id = p_company and a.admin_id = me and now() between a.starts_at and a.ends_at) then
    raise exception 'Open a support session first' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'company', (select jsonb_build_object('name', c.name, 'kind', c.kind, 'created_at', c.created_at) from public.company c where c.id = p_company),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', p.first_name || ' ' || p.last_name, 'roles', m.roles, 'status', m.status,
               'team', t.name, 'starts_on', m.starts_on,
               'last_visit_at', (select max(v.updated_at) from public.visit v where v.company_id = p_company and v.merchandiser_id = m.person_id),
               'sync_pending', sr.pending, 'sync_failed', sr.failed, 'sync_reported_at', sr.reported_at)
             order by m.status, p.first_name)
      from public.membership m
      join public.person p on p.id = m.person_id
      left join public.team t on t.id = m.team_id
      left join public.sync_report sr on sr.company_id = p_company and sr.person_id = m.person_id
      where m.company_id = p_company), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(t.name order by t.name) from public.team t where t.company_id = p_company), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('date', d.work_date, 'visits', d.visits, 'finished', d.finished, 'approved', d.approved, 'photos', d.photos) order by d.work_date desc)
      from (
        select v.work_date,
               count(*)::int as visits,
               count(*) filter (where v.work_status in ('done', 'refused', 'closed'))::int as finished,
               count(*) filter (where v.review_status = 'approved')::int as approved,
               (select count(*)::int from public.photo f where f.company_id = p_company and f.deleted_at is null
                  and f.visit_id in (select x.id from public.visit x where x.company_id = p_company and x.work_date = v.work_date)) as photos
        from public.visit v
        where v.company_id = p_company and v.deleted_at is null and v.work_date >= current_date - 14
        group by v.work_date
      ) d), '[]'::jsonb),
    'catalogs', jsonb_build_object(
      'brands', (select count(*) from public.brand b where b.company_id = p_company),
      'display_types', (select count(*) from public.display_type d where d.company_id = p_company),
      'stores', (select count(*) from public.store s where s.company_id = p_company)),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('reason', a.reason, 'starts_at', a.starts_at, 'ends_at', a.ends_at,
                                          'by', (select p.first_name || ' ' || p.last_name from public.person p where p.id = a.admin_id))
             order by a.starts_at desc)
      from (select * from public.support_access a where a.company_id = p_company order by a.starts_at desc limit 10) a), '[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke execute on function public.platform_companies, public.platform_totals, public.platform_create_company,
  public.platform_set_plan, public.start_support, public.support_company from public, anon;
grant execute on function public.platform_companies, public.platform_totals, public.platform_create_company,
  public.platform_set_plan, public.start_support, public.support_company to authenticated;
