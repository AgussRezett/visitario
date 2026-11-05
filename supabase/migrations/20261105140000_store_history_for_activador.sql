-- =============================================================================
-- The activador sees the store's history from a visit of their day: the finished
-- visits of that store (anyone's), and each one in detail, photos included. Read only.
--
-- Not by widening visit's RLS: the policies on displays, photos, metrics and brands
-- also allow editing when the visit is visible, so a wider visit rule would let an
-- activador edit other people's work. These functions read, with the rule inside:
-- a finished visit of a store that is in one of my own visits.
-- =============================================================================

-- A finished visit of a store I have (or had) in one of my own days, in my company.
create function private.in_my_store_history(p_visit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.visit h
    join public.visit mine on mine.company_id = h.company_id and mine.store_id = h.store_id
    join public.membership m on m.company_id = h.company_id and m.person_id = mine.merchandiser_id
    where h.id = p_visit and h.deleted_at is null and h.work_status in ('done', 'refused', 'closed')
      and mine.merchandiser_id = private.current_person_id() and mine.deleted_at is null
      and m.status = 'active' and 'merchandiser' = any (m.roles))
$$;

-- The store's finished visits, newest first, seen from one of my visits (not counting it).
-- A visit carried over to another day shows once: the last one.
create function public.store_history(p_visit uuid)
returns table (id uuid, work_date date, merchandiser text, work_status public.work_status, consent public.consent_kind,
               review_status public.review_status, displays integer, afters integer)
language sql stable security definer set search_path = '' as $$
  select h.id, h.work_date, p.first_name, h.work_status, h.consent, h.review_status,
         (select count(*)::integer from public.display d where d.visit_id = h.id and d.deleted_at is null),
         (select count(*)::integer from public.photo f where f.visit_id = h.id and f.kind = 'after' and f.deleted_at is null and f.uploaded_at is not null)
  from public.visit mine
  join public.visit h on h.company_id = mine.company_id and h.store_id = mine.store_id
  join public.person p on p.id = h.merchandiser_id
  where mine.id = p_visit and mine.merchandiser_id = private.current_person_id() and mine.deleted_at is null
    and h.id <> mine.id and h.deleted_at is null and h.work_status in ('done', 'refused', 'closed')
    and not exists (select 1 from public.visit c where c.resumed_from = h.id and c.deleted_at is null)
    and private.in_my_store_history(h.id)
  order by h.work_date desc, h.finished_at desc nulls last
  limit 40
$$;

-- One of those visits, shaped like the app's visit rows, with its work (metrics, brands).
create function public.history_visit(p_visit uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', v.id, 'company_id', v.company_id, 'workday_id', v.workday_id, 'work_date', v.work_date, 'sort_order', v.sort_order,
    'task', v.task, 'source', v.source, 'added_by', v.added_by, 'resumed_from', v.resumed_from,
    'work_status', v.work_status, 'review_status', v.review_status, 'auto_approved', v.auto_approved,
    'arrived_at', v.arrived_at, 'consent', v.consent, 'objection', v.objection, 'retry_after', v.retry_after,
    'finished_at', v.finished_at, 'notes', v.notes, 'rapport', v.rapport,
    'merchandiser_id', v.merchandiser_id, 'reviewed_at', v.reviewed_at, 'updated_at', v.updated_at,
    'adder', (select jsonb_build_object('first_name', a.first_name) from public.person a where a.id = v.added_by),
    'merchandiser', (select jsonb_build_object('first_name', p.first_name, 'last_name', p.last_name) from public.person p where p.id = v.merchandiser_id),
    'store', (select jsonb_build_object('id', s.id, 'name', s.name, 'address', s.address, 'area', s.area, 'customer_number', s.customer_number,
                'lat', s.lat, 'lng', s.lng, 'location_status', s.location_status, 'channel_id', s.channel_id, 'seller_id', s.seller_id)
              from public.store s where s.id = v.store_id),
    'display', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'display_type_id', d.display_type_id, 'reference', d.reference,
                'source', d.source, 'sort_order', d.sort_order, 'deleted_at', d.deleted_at)) from public.display d where d.visit_id = v.id), '[]'),
    'photo', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'display_id', f.display_id, 'taken_at', f.taken_at,
                'uploaded_at', f.uploaded_at, 'deleted_at', f.deleted_at)) from public.photo f where f.visit_id = v.id), '[]'),
    'metrics', coalesce((select jsonb_agg(jsonb_build_object('metric_id', x.metric_id, 'quantity', x.quantity)) from public.visit_metric x where x.visit_id = v.id), '[]'),
    'brands', coalesce((select jsonb_agg(b.brand_id) from public.visit_brand b where b.visit_id = v.id), '[]'))
  from public.visit v
  where v.id = p_visit and private.in_my_store_history(v.id)
$$;

-- Which of these photos the caller may see through the store's history (for their links).
create function public.history_photos(p_ids uuid[])
returns table (id uuid, company_id uuid, visit_id uuid)
language sql stable security definer set search_path = '' as $$
  select f.id, f.company_id, f.visit_id
  from public.photo f
  where f.id = any (p_ids) and f.deleted_at is null and f.uploaded_at is not null
    and private.in_my_store_history(f.visit_id)
$$;

revoke all on function private.in_my_store_history(uuid) from public, anon;
revoke all on function public.store_history(uuid) from public, anon;
revoke all on function public.history_visit(uuid) from public, anon;
revoke all on function public.history_photos(uuid[]) from public, anon;
grant execute on function private.in_my_store_history(uuid) to authenticated;
grant execute on function public.store_history(uuid) to authenticated;
grant execute on function public.history_visit(uuid) to authenticated;
grant execute on function public.history_photos(uuid[]) to authenticated;
