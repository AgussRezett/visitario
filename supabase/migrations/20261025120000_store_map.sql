-- =============================================================================
-- Points of sale on a map.
--   · store_map(): every point with its place, seller, channel, last activation, how many
--     in 30 and 90 days, and its reputation. Supervisors and admins see the company's
--     points; a seller sees only their own clients; anyone else, nothing.
--   · client_history(): one point with its last activations (date, result, who, displays
--     and work numbers), for the same people. No photos or private data.
-- Counted like the directory: drafts and visits later resumed elsewhere do not count.
-- =============================================================================

create function private.map_scope(p_company uuid) returns table (all_stores boolean, seller_ids integer[])
language sql stable security definer set search_path = '' as $$
  select p_company in (select private.companies_with_role('supervisor')) or p_company in (select private.companies_with_role('admin')),
         coalesce((select array_agg(x.id) from public.seller x
                   where x.company_id = p_company and x.person_id = private.current_person_id()
                     and p_company in (select private.companies_with_role('seller'))), '{}');
$$;

create function public.store_map(p_company uuid)
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
      and exists (select 1 from public.workday w where w.id = v.workday_id and w.status <> 'draft')
  )
  select s.id, s.name, s.address, s.area, s.customer_number, s.lat, s.lng, s.location_status, s.channel_id, s.seller_id,
         lv.work_date, lv.work_status, lv.first_name,
         (select count(*)::integer from counted v where v.store_id = s.id and v.work_date >= current_date - 30),
         (select count(*)::integer from counted v where v.store_id = s.id and v.work_date >= current_date - 90),
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

create function public.client_history(p_company uuid, p_store uuid) returns jsonb
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
      and exists (select 1 from public.workday w where w.id = v.workday_id and w.status <> 'draft')
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

revoke all on function private.map_scope(uuid) from public, anon;
grant execute on function private.map_scope(uuid) to authenticated;
revoke all on function public.store_map(uuid), public.client_history(uuid, uuid) from public, anon;
grant execute on function public.store_map(uuid), public.client_history(uuid, uuid) to authenticated;
