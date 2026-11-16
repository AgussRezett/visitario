-- =============================================================================
-- Stage B of the seller: their own visits to their clients (with an order, without one and
-- why, or closed), a light order note to send by WhatsApp, and how their portfolio is
-- covered against a monthly target the supervisor sets. Prices, stock and invoicing stay
-- in the distributor's own system.
-- =============================================================================

create type public.seller_visit_outcome as enum ('order', 'no_order', 'closed');

alter table public.seller add column monthly_target smallint check (monthly_target between 1 and 2000);
comment on column public.seller.monthly_target is 'Visits a month the supervisor expects from this seller (null: none).';

create table public.seller_visit (
  id           uuid primary key,  -- from the phone: sending it twice does not duplicate
  company_id   uuid not null,
  store_id     uuid not null,
  seller_id    integer not null,
  person_id    uuid not null references public.person (id) on delete restrict,
  visited_at   timestamptz not null default now(),
  outcome      public.seller_visit_outcome not null,
  reason       text check (reason is null or char_length(reason) between 1 and 80),
  note         text check (note is null or char_length(note) <= 500),
  -- [{"qty": 2, "item": "SKYY 750 caja x6"}], what the client asked for (no prices).
  order_lines  jsonb not null default '[]'::jsonb
               check (jsonb_typeof(order_lines) = 'array' and jsonb_array_length(order_lines) <= 60),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1,
  deleted_at   timestamptz,
  foreign key (company_id, store_id) references public.store (company_id, id),
  foreign key (company_id, seller_id) references public.seller (company_id, id)
);
comment on table public.seller_visit is 'A seller''s visit to a client: the outcome and, with an order, what was asked for.';
create index seller_visit_store on public.seller_visit (store_id, visited_at desc) where deleted_at is null;
create index seller_visit_seller on public.seller_visit (company_id, seller_id, visited_at) where deleted_at is null;
create trigger touch before insert or update on public.seller_visit for each row execute function private.touch();

alter table public.seller_visit enable row level security;
alter table public.seller_visit force row level security;
revoke all on public.seller_visit from anon, authenticated;
create policy seller_visit_select on public.seller_visit for select to authenticated
  using (company_id in (select private.my_companies())
         and (private.is_boss(company_id) or person_id = (select private.current_person_id())));
-- Changes only through the functions below.
grant select on public.seller_visit to authenticated;

-- The seller records a visit to one of their clients. The order lines are checked here: a
-- quantity from 1 to 9999 and a product of 1 to 80 characters each.
create function public.record_seller_visit(p_id uuid, p_store uuid, p_outcome public.seller_visit_outcome,
  p_reason text default null, p_note text default null, p_lines jsonb default '[]'::jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s     public.store%rowtype;
  lines jsonb;
begin
  if exists (select 1 from public.seller_visit where id = p_id) then
    return p_id;  -- already sent (a retry)
  end if;
  select * into s from public.store where id = p_store and deleted_at is null;
  if not found or not private.is_my_client(p_store) then
    raise exception 'Only the client''s seller records a visit to it' using errcode = '42501';
  end if;
  if p_outcome <> 'order' then
    lines := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('qty', (l->>'qty')::integer, 'item', btrim(l->>'item'))), '[]'::jsonb)
    into lines
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
    where nullif(btrim(l->>'item'), '') is not null;
    if exists (select 1 from jsonb_array_elements(lines) l
               where (l->>'qty')::integer not between 1 and 9999 or char_length(l->>'item') > 80) then
      raise exception 'Each order line needs a quantity from 1 to 9999 and a product of up to 80 characters' using errcode = '23514';
    end if;
  end if;
  insert into public.seller_visit (id, company_id, store_id, seller_id, person_id, outcome, reason, note, order_lines)
  values (p_id, s.company_id, p_store, s.seller_id, private.current_person_id(), p_outcome,
          case when p_outcome = 'no_order' then left(nullif(btrim(p_reason), ''), 80) end,
          left(nullif(btrim(p_note), ''), 500), lines);
  return p_id;
end $$;

-- A mistake: whoever recorded it takes it back the same day.
create function public.remove_seller_visit(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.seller_visit set deleted_at = now()
  where id = p_id and person_id = private.current_person_id() and deleted_at is null
    and (visited_at at time zone 'America/Argentina/Buenos_Aires')::date = (now() at time zone 'America/Argentina/Buenos_Aires')::date;
end $$;

-- The supervisor (or an admin) sets a seller's monthly target; null removes it.
create function public.set_seller_target(p_seller integer, p_target integer) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c uuid;
begin
  select company_id into c from public.seller where id = p_seller;
  if c is null or not private.is_boss(c) then
    raise exception 'Only a supervisor or an admin sets a seller''s target' using errcode = '42501';
  end if;
  update public.seller set monthly_target = nullif(p_target, 0) where id = p_seller;
end $$;

-- How each seller covered their portfolio in a period: clients, clients visited by the
-- seller, visits, orders, and clients with a finished activation. A supervisor or admin
-- sees every seller; a seller, themselves.
create function public.seller_coverage(p_company uuid, p_from date, p_to date)
returns table (seller_id integer, name text, has_user boolean, monthly_target integer, clients integer,
               visited_clients integer, visits integer, orders integer, no_orders integer, closed integer, activated_clients integer)
language sql stable security definer set search_path = '' as $$
  with scope as (select * from private.map_scope(p_company)),
  sellers as (
    select x.* from public.seller x, scope
    where x.company_id = p_company and (scope.all_stores or x.id = any (scope.seller_ids))
      and (x.active or x.person_id is not null)
  ),
  stores as (
    select s.id, s.seller_id from public.store s
    where s.company_id = p_company and s.deleted_at is null and s.seller_id in (select id from sellers)
  ),
  sv as (
    select v.* from public.seller_visit v
    where v.company_id = p_company and v.deleted_at is null and v.seller_id in (select id from sellers)
      and (v.visited_at at time zone 'America/Argentina/Buenos_Aires')::date between p_from and p_to
  ),
  activated as (
    select distinct v.store_id from public.visit v
    where v.company_id = p_company and v.deleted_at is null and v.work_status = 'done'
      and v.work_date between p_from and p_to and v.store_id in (select id from stores)
  )
  select x.id, x.name, x.person_id is not null, x.monthly_target::integer,
         (select count(*)::integer from stores s where s.seller_id = x.id),
         (select count(distinct v.store_id)::integer from sv v where v.seller_id = x.id and v.store_id in (select id from stores)),
         (select count(*)::integer from sv v where v.seller_id = x.id),
         (select count(*)::integer from sv v where v.seller_id = x.id and v.outcome = 'order'),
         (select count(*)::integer from sv v where v.seller_id = x.id and v.outcome = 'no_order'),
         (select count(*)::integer from sv v where v.seller_id = x.id and v.outcome = 'closed'),
         (select count(*)::integer from activated a join stores s on s.id = a.store_id where s.seller_id = x.id)
  from sellers x
  order by x.name;
$$;

revoke all on function public.record_seller_visit(uuid, uuid, public.seller_visit_outcome, text, text, jsonb) from public, anon;
revoke all on function public.remove_seller_visit(uuid) from public, anon;
revoke all on function public.set_seller_target(integer, integer) from public, anon;
revoke all on function public.seller_coverage(uuid, date, date) from public, anon;
grant execute on function public.record_seller_visit(uuid, uuid, public.seller_visit_outcome, text, text, jsonb) to authenticated;
grant execute on function public.remove_seller_visit(uuid) to authenticated;
grant execute on function public.set_seller_target(integer, integer) to authenticated;
grant execute on function public.seller_coverage(uuid, date, date) to authenticated;

-- "Mis clientes" also says when the seller last went, and how it went.
drop function public.seller_stores(uuid);
create function public.seller_stores(p_company uuid)
returns table (id uuid, name text, address text, area text, customer_number text, channel_id integer,
               last_visit_date date, last_visit_status public.work_status, last_visit_review public.review_status,
               last_merchandiser text, visits_30d integer, my_last_visit date, my_last_outcome public.seller_visit_outcome)
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
      and v.work_status <> 'pending' -- what happened, whatever the day's status
  )
  select s.id, s.name, s.address, s.area, s.customer_number, s.channel_id,
         lv.work_date, lv.work_status, lv.review_status, lv.first_name,
         (select count(*)::integer from counted v where v.store_id = s.id and v.work_status = 'done' and v.work_date >= current_date - 30),
         (mv.visited_at at time zone 'America/Argentina/Buenos_Aires')::date, mv.outcome
  from public.store s
  left join lateral (
    select v.work_date, v.work_status, v.review_status, mp.first_name
    from counted v join public.person mp on mp.id = v.merchandiser_id
    where v.store_id = s.id
    order by v.work_date desc, v.sort_order desc
    limit 1
  ) lv on true
  left join lateral (
    select sv.visited_at, sv.outcome from public.seller_visit sv
    where sv.store_id = s.id and sv.deleted_at is null and sv.person_id = private.current_person_id()
    order by sv.visited_at desc
    limit 1
  ) mv on true
  where s.company_id = p_company and s.deleted_at is null and s.seller_id in (select id from me)
  order by lv.work_date desc nulls last, s.name nulls last, s.address;
$$;
revoke all on function public.seller_stores(uuid) from public, anon;
grant execute on function public.seller_stores(uuid) to authenticated;
