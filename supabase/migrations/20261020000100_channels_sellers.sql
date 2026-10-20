-- =============================================================================
-- Channels and sellers.
--   channel: the kind of shop (Autoservicio, Kiosco...), a company catalog.
--   seller:  who sells to the store. A name the admin loads, linked to a person once
--            that person joins the company with the seller role (or created then).
-- Every store can have one of each. Both show in the visit, the review, the directory
-- and the messages ({canal}, {vendedor}).
-- =============================================================================

-- A membership can now hold the four roles.
alter table public.membership drop constraint membership_roles_check,
  add constraint membership_roles_check check (cardinality(roles) between 1 and 4 and array_position(roles, null) is null);
alter table public.invitation drop constraint invitation_roles_check,
  add constraint invitation_roles_check check (cardinality(roles) between 1 and 4 and array_position(roles, null) is null);

create table public.channel (
  id          integer generated always as identity primary key,
  company_id  uuid not null references public.company (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  active      boolean not null default true,
  sort_order  smallint not null default 0,
  updated_at  timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name)
);
comment on table public.channel is 'Kind of shop (Autoservicio, Kiosco...). sort_order is the number the company uses for it.';

create table public.seller (
  id          integer generated always as identity primary key,
  company_id  uuid not null references public.company (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  person_id   uuid references public.person (id) on delete set null,
  active      boolean not null default true,
  sort_order  smallint not null default 0,
  updated_at  timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name),
  unique (company_id, person_id)
);
comment on table public.seller is 'Who sells to a store. person_id: their Visitario user, set when they join with the seller role.';

alter table public.store add column channel_id integer, add column seller_id integer,
  add foreign key (company_id, channel_id) references public.channel (company_id, id),
  add foreign key (company_id, seller_id) references public.seller (company_id, id);
create index store_seller on public.store (company_id, seller_id) where deleted_at is null;
create index store_channel on public.store (company_id, channel_id) where deleted_at is null;

-- Catalogs: any member reads them, admins edit them. Never deleted: deactivated.
alter table public.channel enable row level security;
alter table public.channel force row level security;
alter table public.seller enable row level security;
alter table public.seller force row level security;
revoke all on public.channel, public.seller from anon, authenticated;

create policy channel_select on public.channel for select to authenticated
  using (company_id in (select private.my_companies()));
create policy channel_admin_insert on public.channel for insert to authenticated
  with check (company_id in (select private.companies_with_role('admin')));
create policy channel_admin_update on public.channel for update to authenticated
  using (company_id in (select private.companies_with_role('admin')))
  with check (company_id in (select private.companies_with_role('admin')));
grant select, insert, update on public.channel to authenticated;

create policy seller_select on public.seller for select to authenticated
  using (company_id in (select private.my_companies()));
create policy seller_admin_insert on public.seller for insert to authenticated
  with check (company_id in (select private.companies_with_role('admin')));
create policy seller_admin_update on public.seller for update to authenticated
  using (company_id in (select private.companies_with_role('admin')))
  with check (company_id in (select private.companies_with_role('admin')));
-- person_id only through the membership trigger: an admin cannot point a name at anyone.
grant select on public.seller to authenticated;
grant insert (company_id, name, active, sort_order), update (name, active, sort_order) on public.seller to authenticated;

-- -----------------------------------------------------------------------------
-- Someone active with the seller role is a seller: the name the admin loaded
-- (same full or first name, still without a person) or a new one with their name.
-- -----------------------------------------------------------------------------
create function private.link_seller() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  full_name text;
  first     text;
  sid       integer;
begin
  if new.status <> 'active' or not ('seller' = any (new.roles)) then return null; end if;
  if exists (select 1 from public.seller s where s.company_id = new.company_id and s.person_id = new.person_id) then
    update public.seller s set active = true where s.company_id = new.company_id and s.person_id = new.person_id and not s.active;
    return null;
  end if;
  select btrim(p.first_name || ' ' || p.last_name), p.first_name into full_name, first
  from public.person p where p.id = new.person_id;
  select s.id into sid from public.seller s
  where s.company_id = new.company_id and s.person_id is null
    and private.normalize(s.name) in (private.normalize(full_name), private.normalize(first))
  order by private.normalize(s.name) = private.normalize(full_name) desc, s.id
  limit 1;
  if sid is not null then
    update public.seller s set person_id = new.person_id, active = true where s.id = sid;
  else
    insert into public.seller (company_id, name, person_id)
    values (new.company_id, left(full_name, 80), new.person_id)
    on conflict do nothing;
  end if;
  return null;
end $$;

create trigger link_seller after insert or update of roles, status on public.membership
  for each row execute function private.link_seller();

-- Members already active as sellers (none yet; kept for completeness).
update public.membership set roles = roles where status = 'active' and 'seller' = any (roles);

-- -----------------------------------------------------------------------------
-- Channel and seller of a store. Supervisors and admins set them; whoever adds a
-- store (an activador too) can fill them while empty. Null leaves a field as is.
-- -----------------------------------------------------------------------------
create function public.tag_store(p_store uuid, p_channel integer default null, p_seller integer default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  s    public.store%rowtype;
  boss boolean;
begin
  select * into s from public.store where id = p_store and deleted_at is null;
  if not found or s.company_id not in (select private.my_companies()) then
    raise exception 'Store not found' using errcode = 'P0002';
  end if;
  if p_channel is not null and not exists (select 1 from public.channel c where c.id = p_channel and c.company_id = s.company_id and c.active) then
    raise exception 'Channel not found' using errcode = 'P0002';
  end if;
  if p_seller is not null and not exists (select 1 from public.seller x where x.id = p_seller and x.company_id = s.company_id and x.active) then
    raise exception 'Seller not found' using errcode = 'P0002';
  end if;
  boss := s.company_id in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin'));
  update public.store t
  set channel_id = case when p_channel is not null and (boss or t.channel_id is null) then p_channel else t.channel_id end,
      seller_id  = case when p_seller  is not null and (boss or t.seller_id  is null) then p_seller  else t.seller_id  end
  where t.id = p_store
    and (t.channel_id is distinct from coalesce(p_channel, t.channel_id) or t.seller_id is distinct from coalesce(p_seller, t.seller_id));
end $$;

-- -----------------------------------------------------------------------------
-- The directory, now with channel and seller (and filters by them: 0 = without).
-- -----------------------------------------------------------------------------
create function public.store_directory_v2(p_company uuid, p_query text default null, p_filter text default 'all',
                                          p_area text default null, p_channel integer default null, p_seller integer default null,
                                          p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, address text, area text, customer_number text,
               location_status public.location_status, source public.store_source, created_by_name text,
               channel_id integer, seller_id integer,
               last_visit_date date, last_visit_status public.work_status, last_visit_review public.review_status,
               last_merchandiser text, visits_30d integer, total bigint)
language sql stable security invoker set search_path = '' as $$
  with base as (
    select s.* from public.store s
    where s.company_id = p_company
      and (case when p_filter = 'archived' then s.deleted_at is not null and s.merged_into is null and s.removed_at is null
                else s.deleted_at is null end)
      and (char_length(btrim(coalesce(p_query, ''))) < 2
           or private.normalize(coalesce(s.name, '') || ' ' || s.address || ' ' || coalesce(s.customer_number, ''))
              like '%' || private.normalize(p_query) || '%')
      and (p_filter is distinct from 'unverified' or s.location_status <> 'verified')
      and (p_filter is distinct from 'added' or s.source = 'merchandiser')
      and (p_area is null or s.area = p_area)
      and (p_channel is null or (p_channel = 0 and s.channel_id is null) or s.channel_id = p_channel)
      and (p_seller is null or (p_seller = 0 and s.seller_id is null) or s.seller_id = p_seller)
  ),
  counted as (
    select v.* from public.visit v
    where v.deleted_at is null
      and not exists (select 1 from public.visit c where c.resumed_from = v.id and c.deleted_at is null)
  )
  select b.id, b.name, b.address, b.area, b.customer_number, b.location_status, b.source, cp.first_name,
         b.channel_id, b.seller_id,
         lv.work_date, lv.work_status, lv.review_status, lv.first_name,
         (select count(*)::integer from counted v where v.store_id = b.id and v.work_date >= current_date - 30),
         count(*) over ()
  from base b
  left join public.person cp on cp.id = b.created_by
  left join lateral (
    select v.work_date, v.work_status, v.review_status, mp.first_name
    from counted v join public.person mp on mp.id = v.merchandiser_id
    where v.store_id = b.id
    order by v.work_date desc, v.sort_order desc
    limit 1
  ) lv on true
  order by b.name nulls last, b.address
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;

-- -----------------------------------------------------------------------------
-- A seller's clients: their stores with the last activation (date, how it ended
-- and who did it). Only the seller themself; no photos or private data.
-- -----------------------------------------------------------------------------
create function public.seller_stores(p_company uuid)
returns table (id uuid, name text, address text, area text, customer_number text, channel_id integer,
               last_visit_date date, last_visit_status public.work_status, last_visit_review public.review_status,
               last_merchandiser text, visits_30d integer)
language sql stable security definer set search_path = '' as $$
  with me as (
    select x.id from public.seller x
    where x.company_id = p_company and x.person_id = private.current_person_id()
      and p_company in (select private.companies_with_role('seller'))
  ),
  counted as (
    select v.* from public.visit v
    where v.company_id = p_company and v.deleted_at is null
      and not exists (select 1 from public.visit c where c.resumed_from = v.id and c.deleted_at is null)
      and exists (select 1 from public.workday w where w.id = v.workday_id and w.status <> 'draft')
  )
  select s.id, s.name, s.address, s.area, s.customer_number, s.channel_id,
         lv.work_date, lv.work_status, lv.review_status, lv.first_name,
         (select count(*)::integer from counted v where v.store_id = s.id and v.work_date >= current_date - 30)
  from public.store s
  left join lateral (
    select v.work_date, v.work_status, v.review_status, mp.first_name
    from counted v join public.person mp on mp.id = v.merchandiser_id
    where v.store_id = s.id
    order by v.work_date desc, v.sort_order desc
    limit 1
  ) lv on true
  where s.company_id = p_company and s.deleted_at is null and s.seller_id in (select id from me)
  order by lv.work_date desc nulls last, s.name nulls last, s.address;
$$;

-- -----------------------------------------------------------------------------
-- Import: each row can name its store's seller and channel.
-- -----------------------------------------------------------------------------
create or replace function public.import_workdays(p_company uuid, p_date date, p_rows jsonb, p_format jsonb default null)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  me        uuid := private.current_person_id();
  r         jsonb;
  sid       uuid;
  wid       uuid;
  cn        text;
  addr      text;
  plans     jsonb := '{}';
  n_visits  integer := 0;
  n_stores  integer := 0;
  before    integer;
  after     integer;
begin
  if p_company not in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')) then
    raise exception 'Only supervisors and admins can import' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'An import has 1 to 500 rows' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    sid  := nullif(r ->> 'store', '')::uuid;
    cn   := nullif(btrim(r ->> 'customer_number'), '');
    addr := nullif(btrim(r ->> 'address'), '');

    if sid is not null and not exists (select 1 from public.store s where s.id = sid and s.company_id = p_company and s.deleted_at is null) then
      raise exception 'Store not found' using errcode = 'P0002';
    end if;
    -- Looked up again here: two rows of the same file, or someone else, may have created it meanwhile.
    if sid is null and cn is not null then
      select s.id into sid from public.store s where s.company_id = p_company and s.customer_number = cn and s.deleted_at is null;
    end if;
    if sid is null and addr is not null then
      select s.id into sid from public.store s
      where s.company_id = p_company and s.deleted_at is null and private.normalize(s.address) = private.normalize(addr)
      order by s.id limit 1;
    end if;

    if sid is null then
      if addr is null then
        raise exception 'A new store needs an address' using errcode = '23502';
      end if;
      insert into public.store (company_id, customer_number, name, address, area, lat, lng, location_status, source, created_by)
      values (p_company, cn, nullif(btrim(r ->> 'name'), ''), addr, nullif(btrim(r ->> 'area'), ''),
              (r ->> 'lat')::double precision, (r ->> 'lng')::double precision,
              case when r ->> 'lat' is null then 'unverified'
                   else coalesce(nullif(r ->> 'location_status', ''), 'approximate') end::public.location_status,
              'imported', me)
      returning id into sid;
      n_stores := n_stores + 1;
    else
      -- What the spreadsheet knows and the directory does not yet (never overwrites).
      update public.store s
      set customer_number = coalesce(s.customer_number, cn),
          name = coalesce(s.name, nullif(btrim(r ->> 'name'), ''))
      where s.id = sid
        and ((s.customer_number is null and cn is not null
              and not exists (select 1 from public.store o where o.company_id = p_company and o.customer_number = cn and o.deleted_at is null))
             or (s.name is null and nullif(btrim(r ->> 'name'), '') is not null));
    end if;

    -- The seller and channel the row names (ids already resolved in the app).
    if nullif(r ->> 'seller', '') is not null or nullif(r ->> 'channel', '') is not null then
      perform public.tag_store(sid, nullif(r ->> 'channel', '')::integer, nullif(r ->> 'seller', '')::integer);
    end if;

    wid := (plans ->> (r ->> 'merchandiser'))::uuid;
    if wid is null then
      wid := public.plan_workday(p_company, (r ->> 'merchandiser')::uuid, p_date);
      plans := plans || jsonb_build_object(r ->> 'merchandiser', wid);
    end if;

    select count(*) into before from public.visit v where v.workday_id = wid and v.deleted_at is null;
    perform public.add_visit(wid, p_store => sid, p_task => r ->> 'task');
    select count(*) into after from public.visit v where v.workday_id = wid and v.deleted_at is null;
    n_visits := n_visits + (after - before);
  end loop;

  if p_format is not null then
    insert into public.import_format (company_id, name, signature, mapping, last_used_at)
    values (p_company, btrim(p_format ->> 'name'), p_format ->> 'signature', p_format -> 'mapping', now())
    on conflict (company_id, signature) do update
      set name = excluded.name, mapping = excluded.mapping, last_used_at = now();
  end if;

  return jsonb_build_object('workdays', (select count(*) from jsonb_object_keys(plans)), 'visits', n_visits, 'stores', n_stores);
end $$;

revoke all on function public.tag_store, public.store_directory_v2, public.seller_stores from public, anon;
grant execute on function public.tag_store, public.store_directory_v2, public.seller_stores to authenticated;
