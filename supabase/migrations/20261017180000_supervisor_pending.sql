-- =============================================================================
-- "Sumar pendientes" when assigning, with the same rules the merchandiser sees:
-- only the last 7 days, without the ones they dismissed, without archived stores and
-- without stores they already visited (or have) on a later day, and never from a day
-- still in draft (the merchandiser never got it). The supervisor picks
-- which ones to add. Same function as 20261017160000_store_tidy_and_remove otherwise.
-- =============================================================================
create or replace function public.merchandiser_pending(p_company uuid, p_merchandiser uuid, p_before date)
returns table (visit_id uuid, work_date date, store_name text, address text,
               work_status public.work_status, finished_at timestamptz, pending_displays integer)
language sql stable security invoker set search_path = '' as $$
  select v.id, v.work_date, s.name, s.address, v.work_status, v.finished_at,
         (select count(*) from public.display d
          where d.visit_id = v.id and d.deleted_at is null
            and not exists (select 1 from public.photo f
                            where f.display_id = d.id and f.kind = 'after' and f.deleted_at is null))::integer
  from public.visit v
  join public.store s on s.id = v.store_id
  join public.workday w on w.id = v.workday_id and w.status <> 'draft'
  where v.company_id = p_company
    and v.merchandiser_id = p_merchandiser
    and v.work_date < p_before and v.work_date >= p_before - 7
    and v.deleted_at is null
    and v.resume_dismissed_at is null
    and s.deleted_at is null
    and v.work_status in ('pending', 'closed')
    and not exists (select 1 from public.visit r where r.resumed_from = v.id and r.deleted_at is null)
    and not exists (select 1 from public.visit n
                    where n.store_id = v.store_id and n.merchandiser_id = v.merchandiser_id
                      and n.work_date > v.work_date and n.deleted_at is null)
  order by v.work_date desc, v.sort_order;
$$;
