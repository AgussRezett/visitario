-- The map says which displays each point of sale has: the display types of its last
-- activation that recorded any (what was there the last time someone saw it). The map and
-- Armar recorrido filter and paint by them.

drop function public.store_map(uuid);
create function public.store_map(p_company uuid)
returns table (id uuid, name text, address text, area text, customer_number text, lat double precision, lng double precision,
               location_status public.location_status, channel_id integer, seller_id integer,
               last_visit_date date, last_visit_status public.work_status, last_merchandiser text,
               visits_30d integer, visits_90d integer, rapport numeric, display_types integer[])
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
            order by v.work_date desc limit 5) r),
         coalesce((
           select array_agg(distinct d.display_type_id order by d.display_type_id)
           from public.display d
           where d.company_id = p_company and d.deleted_at is null
             and d.visit_id = (
               select v.id from counted v
               where v.store_id = s.id and v.work_status = 'done'
                 and exists (select 1 from public.display x where x.visit_id = v.id and x.deleted_at is null)
               order by v.work_date desc, v.sort_order desc
               limit 1)
         ), '{}')
  from stores s
  left join lateral (
    select v.work_date, v.work_status, mp.first_name
    from counted v join public.person mp on mp.id = v.merchandiser_id
    where v.store_id = s.id
    order by v.work_date desc, v.sort_order desc
    limit 1
  ) lv on true;
$$;
revoke all on function public.store_map(uuid) from public, anon;
grant execute on function public.store_map(uuid) to authenticated;
