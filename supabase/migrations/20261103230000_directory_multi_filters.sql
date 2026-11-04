-- =============================================================================
-- Directory filters of several at once: zones Almagro and Villa Urquiza, channels
-- Autoservicio and Kiosco, sellers… (none chosen means all; 0 means "without").
-- Same columns and order as before; the single-value parameters become arrays.
-- =============================================================================
drop function public.store_directory_v2(uuid, text, text, text, integer, integer, integer, integer, text);

create function public.store_directory_v2(p_company uuid, p_query text default null, p_filter text default 'all',
                                          p_areas text[] default null, p_channels integer[] default null, p_sellers integer[] default null,
                                          p_limit integer default 50, p_offset integer default 0, p_sort text default 'name')
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
      -- Several at once; none (null or empty) means all; 0 stands for "without" a channel or seller.
      and (coalesce(cardinality(p_areas), 0) = 0 or s.area = any (p_areas))
      and (coalesce(cardinality(p_channels), 0) = 0 or coalesce(s.channel_id, 0) = any (p_channels))
      and (coalesce(cardinality(p_sellers), 0) = 0 or coalesce(s.seller_id, 0) = any (p_sellers))
  ),
  counted as (
    select v.* from public.visit v
    where v.deleted_at is null
      and not exists (select 1 from public.visit c where c.resumed_from = v.id and c.deleted_at is null)
  )
  select b.id, b.name, b.address, b.area, b.customer_number, b.location_status, b.source, cp.first_name,
         b.channel_id, b.seller_id,
         lv.work_date, lv.work_status, lv.review_status, lv.first_name,
         vc.n,
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
  left join lateral (
    select count(*)::integer as n from counted v where v.store_id = b.id and v.work_date >= current_date - 30
  ) vc on true
  order by
    case when p_sort = 'address' then private.normalize(b.address) end,
    -- Customer numbers as numbers: shorter first, then by digits; stores without one last.
    case when p_sort = 'customer' then b.customer_number is null end,
    case when p_sort = 'customer' then char_length(b.customer_number) end,
    case when p_sort = 'customer' then b.customer_number end,
    case when p_sort = 'area' then b.area is null end,
    case when p_sort = 'area' then b.area end,
    case when p_sort = 'area' then private.normalize(b.address) end,
    case when p_sort = 'recent_visit' then lv.work_date end desc nulls last,
    case when p_sort = 'oldest_visit' then lv.work_date end asc nulls first,
    case when p_sort = 'most_visits' then vc.n end desc,
    case when p_sort = 'newest' then b.created_at end desc,
    b.name nulls last, b.address, b.id
  limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
$$;
revoke all on function public.store_directory_v2 from public, anon;
grant execute on function public.store_directory_v2 to authenticated;
