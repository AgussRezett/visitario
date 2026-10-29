-- =============================================================================
-- Activations count what happened in the store, whatever the day's status.
-- A day an activador built for themself and never published stays a draft, and its
-- visits (done, approved) were left out: a store worked on such a day showed "Nunca
-- activado" on the map. And a visit only planned (pending) counted as one, so a store
-- planned for today looked activated. Now:
-- - the map and a seller's clients: the last visit is the last one somebody went to
--   (not pending), and the activations are the finished ones (done);
-- - a store's history: what happened, plus what is planned on a published day.
-- =============================================================================

create or replace function public.store_map(p_company uuid)
returns table (id uuid, name text, address text, area text, customer_number text, lat double precision, lng double precision,
               location_status public.location_status, channel_id integer, seller_id integer,
               last_visit_date date, last_visit_status public.work_status, last_merchandiser text,
               visits_30d integer, visits_90d integer, rapport numeric)
language sql stable security definer set search_path = '' as $$
  with scope as (select * from private.map_scope(p_company)),
  stores as (
    select s.* from public.store s, scope
    where s.company_id = p_company and s.deleted_at is null
      and (scope.all_stores or s.seller_id = any (scope.seller_ids))
  ),
  counted as (
    select v.* from public.visit v
    where v.company_id = p_company and v.deleted_at is null and v.store_id in (select id from stores)
      and not exists (select 1 from public.visit c where c.resumed_from = v.id and c.deleted_at is null)
      and v.work_status <> 'pending' -- what happened, whatever the day's status
  )
  select s.id, s.name, s.address, s.area, s.customer_number, s.lat, s.lng, s.location_status, s.channel_id, s.seller_id,
         lv.work_date, lv.work_status, lv.first_name,
         (select count(*)::integer from counted v where v.store_id = s.id and v.work_status = 'done' and v.work_date >= current_date - 30),
         (select count(*)::integer from counted v where v.store_id = s.id and v.work_status = 'done' and v.work_date >= current_date - 90),
         (select round(avg(r.p), 2) from (
            select private.rapport_points(v.rapport, v.consent) p from counted v
            where v.store_id = s.id and v.work_date >= current_date - 180 and private.rapport_points(v.rapport, v.consent) is not null
            order by v.work_date desc limit 5) r)
  from stores s
  left join lateral (
    select v.work_date, v.work_status, mp.first_name
    from counted v join public.person mp on mp.id = v.merchandiser_id
    where v.store_id = s.id
    order by v.work_date desc, v.sort_order desc
    limit 1
  ) lv on true;
$$;

create or replace function public.client_history(p_company uuid, p_store uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with scope as (select * from private.map_scope(p_company)),
  st as (
    select s.* from public.store s, scope
    where s.id = p_store and s.company_id = p_company and s.deleted_at is null
      and (scope.all_stores or s.seller_id = any (scope.seller_ids))
  ),
  counted as (
    select v.* from public.visit v
    where v.store_id = p_store and v.company_id = p_company and v.deleted_at is null and exists (select 1 from st)
      and not exists (select 1 from public.visit c where c.resumed_from = v.id and c.deleted_at is null)
      and (v.work_status <> 'pending' or exists (select 1 from public.workday w where w.id = v.workday_id and w.status <> 'draft'))
    order by v.work_date desc, v.sort_order desc
    limit 30
  )
  select case when not exists (select 1 from st) then null else jsonb_build_object(
    'store', (select jsonb_build_object('id', s.id, 'name', s.name, 'address', s.address, 'area', s.area,
              'customer_number', s.customer_number, 'lat', s.lat, 'lng', s.lng, 'channel_id', s.channel_id, 'seller_id', s.seller_id) from st s),
    'visits', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'date', v.work_date, 'status', v.work_status, 'review', v.review_status, 'consent', v.consent,
        'merchandiser', (select p.first_name || ' ' || p.last_name from public.person p where p.id = v.merchandiser_id),
        'displays', coalesce((select jsonb_agg(t.name order by d.sort_order) from public.display d
                              join public.display_type t on t.id = d.display_type_id
                              where d.visit_id = v.id and d.deleted_at is null), '[]'::jsonb),
        'metrics', coalesce((select jsonb_agg(jsonb_build_object('name', w.name, 'quantity', m.quantity) order by w.sort_order)
                             from public.visit_metric m join public.work_metric w on w.id = m.metric_id
                             where m.visit_id = v.id and m.quantity > 0), '[]'::jsonb))
        order by v.work_date desc, v.sort_order desc) from counted v), '[]'::jsonb)) end;
$$;

create or replace function public.seller_stores(p_company uuid)
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
      and v.work_status <> 'pending' -- what happened, whatever the day's status
  )
  select s.id, s.name, s.address, s.area, s.customer_number, s.channel_id,
         lv.work_date, lv.work_status, lv.review_status, lv.first_name,
         (select count(*)::integer from counted v where v.store_id = s.id and v.work_status = 'done' and v.work_date >= current_date - 30)
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
