-- =============================================================================
-- Archiving stores: a supervisor or admin takes a store out of the directory and the
-- searches (deleted_at, as merging does) and can bring it back. Its visits stay.
-- The directory lists archived stores with p_filter = 'archived' (not merged ones).
-- =============================================================================
create or replace function public.store_directory(p_company uuid, p_query text default null, p_filter text default 'all',
                                                  p_area text default null, p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, name text, address text, area text, customer_number text,
               location_status public.location_status, source public.store_source, created_by_name text,
               last_visit_date date, last_visit_status public.work_status, last_visit_review public.review_status,
               last_merchandiser text, visits_30d integer, total bigint)
language sql stable security invoker set search_path = '' as $$
  with base as (
    select s.* from public.store s
    where s.company_id = p_company
      -- 'archived': taken out by hand (merged duplicates stay out of sight)
      and (case when p_filter = 'archived' then s.deleted_at is not null and s.merged_into is null else s.deleted_at is null end)
      and (char_length(btrim(coalesce(p_query, ''))) < 2
           or private.normalize(coalesce(s.name, '') || ' ' || s.address || ' ' || coalesce(s.customer_number, ''))
              like '%' || private.normalize(p_query) || '%')
      and (p_filter is distinct from 'unverified' or s.location_status <> 'verified')
      and (p_filter is distinct from 'added' or s.source = 'merchandiser')
      and (p_area is null or s.area = p_area)
  ),
  counted as (
    select v.* from public.visit v
    where v.deleted_at is null
      and not exists (select 1 from public.visit c where c.resumed_from = v.id and c.deleted_at is null)
  )
  select b.id, b.name, b.address, b.area, b.customer_number, b.location_status, b.source, cp.first_name,
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

