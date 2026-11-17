-- =============================================================================
-- AI usage and limits, per company and per person.
--   · Every use is logged (who, when, what it would cost): admins see who uses it and how.
--   · Visitario sets each company's monthly captures (subscription.ai_monthly_limit; empty:
--     the plan's, 0 on the free plan and 1000 on the others).
--   · The company admin sets captures per person per day (company.ai_daily_per_person;
--     empty: no limit), so one person cannot use up the month.
--   · The whole platform stays within the AI provider's free daily allowance: the edge
--     function passes that cap to private.ai_check.
-- =============================================================================

alter table public.subscription add column ai_monthly_limit integer check (ai_monthly_limit between 0 and 100000);
comment on column public.subscription.ai_monthly_limit is 'AI captures a month Visitario allows this company (null: the plan''s).';

alter table public.company add column ai_daily_per_person smallint default 30 check (ai_daily_per_person between 1 and 500);
comment on column public.company.ai_daily_per_person is 'AI captures a person may use a day (null: no limit). Set by the company admin.';
grant update (ai_daily_per_person) on public.company to authenticated;

create table public.ai_event (
  id                    bigint generated always as identity primary key,
  company_id            uuid not null references public.company (id) on delete cascade,
  person_id             uuid references public.person (id) on delete set null,
  feature               text not null default 'capture' check (feature in ('capture')),
  at                    timestamptz not null default now(),
  cost_usd_thousandths  integer not null default 0 check (cost_usd_thousandths >= 0)
);
comment on table public.ai_event is 'One use of AI: who, when, and what it would cost if paid. Written only by the server.';
create index ai_event_company on public.ai_event (company_id, at);
create index ai_event_person on public.ai_event (person_id, at);
create index ai_event_at on public.ai_event (at);

alter table public.ai_event enable row level security;
alter table public.ai_event force row level security;
revoke all on public.ai_event from anon, authenticated;
create policy ai_event_select on public.ai_event for select to authenticated
  using (company_id in (select private.companies_with_role('admin')));
grant select on public.ai_event to authenticated;

-- The Argentina day and month an instant falls in.
create function private.ar_day(t timestamptz) returns date
language sql immutable set search_path = '' as $$ select (t at time zone 'America/Argentina/Buenos_Aires')::date $$;
create index ai_event_company_day on public.ai_event (company_id, private.ar_day(at));

-- What a company may use a month: Visitario's number, or its plan's; nothing when not active.
create function private.ai_month_limit(p_company uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when s.status <> 'active' then 0
                else coalesce(s.ai_monthly_limit, case when s.plan = 'free' then 0 else 1000 end) end
    from public.subscription s where s.company_id = p_company), 0)
$$;

-- Whether one more use is allowed, and if not, why: plan, month, person_day or platform_day.
create function private.ai_check(p_company uuid, p_person uuid, p_platform_daily integer) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := private.ar_day(now());
  month_start date := date_trunc('month', today)::date;
  per_person smallint;
begin
  if private.ai_month_limit(p_company) = 0 then return 'plan'; end if;
  if (select count(*) from public.ai_event e where e.company_id = p_company and e.at >= month_start::timestamp at time zone 'America/Argentina/Buenos_Aires')
     >= private.ai_month_limit(p_company) then return 'month'; end if;
  select c.ai_daily_per_person into per_person from public.company c where c.id = p_company;
  if per_person is not null and (select count(*) from public.ai_event e where e.company_id = p_company and e.person_id = p_person
                                  and private.ar_day(e.at) = today) >= per_person then return 'person_day'; end if;
  if p_platform_daily is not null and (select count(*) from public.ai_event e where private.ar_day(e.at) = today) >= p_platform_daily then
    return 'platform_day';
  end if;
  return null;
end $$;

-- The server asks before reading (service role only).
create function public.ai_allow(p_company uuid, p_person uuid, p_platform_daily integer default null) returns text
language sql stable security definer set search_path = '' as $$ select private.ai_check(p_company, p_person, p_platform_daily) $$;
revoke all on function public.ai_allow(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_allow(uuid, uuid, integer) to service_role;

-- Every use is logged, and the month adds up as before.
drop function public.record_ai_usage(uuid, integer);
create function public.record_ai_usage(p_company uuid, p_cost_thousandths integer, p_person uuid default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into public.ai_event (company_id, person_id, cost_usd_thousandths) values (p_company, p_person, greatest(p_cost_thousandths, 0));
  insert into public.ai_usage (company_id, month, captures, cost_usd_thousandths)
  values (p_company, date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date, 1, greatest(p_cost_thousandths, 0))
  on conflict (company_id, month) do update
    set captures = public.ai_usage.captures + 1,
        cost_usd_thousandths = public.ai_usage.cost_usd_thousandths + excluded.cost_usd_thousandths
  returning captures into n;
  return n;
end $$;
revoke all on function public.record_ai_usage(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.record_ai_usage(uuid, integer, uuid) to service_role;

-- What is left for me, for whoever may use AI in the company: the month and my day.
create function public.ai_quota(p_company uuid)
returns table (month_used integer, month_limit integer, my_today integer, my_daily_limit integer)
language sql stable security definer set search_path = '' as $$
  select (select count(*)::integer from public.ai_event e where e.company_id = p_company
            and e.at >= date_trunc('month', private.ar_day(now()))::timestamp at time zone 'America/Argentina/Buenos_Aires'),
         private.ai_month_limit(p_company),
         (select count(*)::integer from public.ai_event e where e.company_id = p_company
            and e.person_id = private.current_person_id() and private.ar_day(e.at) = private.ar_day(now())),
         (select c.ai_daily_per_person::integer from public.company c where c.id = p_company)
  where p_company in (select private.my_companies())
$$;
revoke all on function public.ai_quota(uuid) from public, anon;
grant execute on function public.ai_quota(uuid) to authenticated;

-- For the company admin: this month by person and by day.
create function public.company_ai_usage(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', private.ar_day(now()))::timestamp at time zone 'America/Argentina/Buenos_Aires';
begin
  if p_company not in (select private.companies_with_role('admin')) then
    raise exception 'Only a company admin can see its AI usage' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(p.first_name || ' ' || p.last_name, 'Sin nombre'), 'month', x.month, 'today', x.today) order by x.month desc)
      from (select e.person_id, count(*)::integer as month, count(*) filter (where private.ar_day(e.at) = private.ar_day(now()))::integer as today
            from public.ai_event e where e.company_id = p_company and e.at >= month_start group by e.person_id) x
      left join public.person p on p.id = x.person_id), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'captures', d.n) order by d.day)
      from (select private.ar_day(e.at) as day, count(*)::integer n from public.ai_event e
            where e.company_id = p_company and e.at >= month_start group by 1) d), '[]'::jsonb));
end $$;
revoke all on function public.company_ai_usage(uuid) from public, anon;
grant execute on function public.company_ai_usage(uuid) to authenticated;

-- Visitario sets a company's monthly captures (null: back to the plan's).
create function public.platform_set_ai_limit(p_company uuid, p_limit integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only Visitario admins' using errcode = '42501';
  end if;
  insert into public.subscription (company_id, ai_monthly_limit) values (p_company, p_limit)
  on conflict (company_id) do update set ai_monthly_limit = excluded.ai_monthly_limit, updated_at = now();
end $$;
revoke all on function public.platform_set_ai_limit(uuid, integer) from public, anon;
grant execute on function public.platform_set_ai_limit(uuid, integer) to authenticated;

-- The platform list and totals now say each company's limit and today's use of the free allowance.
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
  ai_limit integer, ai_custom_limit integer
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
         private.ai_month_limit(c.id), s.ai_monthly_limit
  from public.company c
  left join public.subscription s on s.company_id = c.id
  left join public.ai_usage u on u.company_id = c.id and u.month = this_month
  order by c.kind = 'personal', c.created_at;
end $$;
revoke all on function public.platform_companies() from public, anon;
grant execute on function public.platform_companies() to authenticated;

drop function public.platform_totals();
create function public.platform_totals()
returns table (active_people integer, photos integer, photo_bytes bigint, db_bytes bigint, ai_captures integer, ai_cost_usd_thousandths integer, ai_captures_today integer)
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
         (select coalesce(sum(u.cost_usd_thousandths), 0)::int from public.ai_usage u where u.month = this_month),
         (select count(*)::int from public.ai_event e where private.ar_day(e.at) = private.ar_day(now()));
end $$;
revoke all on function public.platform_totals() from public, anon;
grant execute on function public.platform_totals() to authenticated;
