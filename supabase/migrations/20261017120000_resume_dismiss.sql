-- =============================================================================
-- Resuming pending visits without the noise:
--   · the merchandiser can dismiss a pending or closed visit: it is not offered again
--     (it stays in its day as not visited);
--   · only the last 7 days are offered;
--   · a visit is not offered when the same store already has a newer visit of theirs.
-- =============================================================================
alter table public.visit add column resume_dismissed_at timestamptz;
comment on column public.visit.resume_dismissed_at is 'The merchandiser chose not to resume it; resumable_visits leaves it out.';

create or replace function public.resumable_visits(p_company uuid, p_before date)
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
  where v.company_id = p_company
    and v.merchandiser_id = private.current_person_id()
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

-- Dismiss: only my own pending or closed visits. Returns how many were dismissed.
create function public.dismiss_resumable(p_visits uuid[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update public.visit set resume_dismissed_at = now()
  where id = any (p_visits)
    and merchandiser_id = private.current_person_id()
    and work_status in ('pending', 'closed')
    and resume_dismissed_at is null
    and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.dismiss_resumable(uuid[]) from public, anon;
grant execute on function public.dismiss_resumable(uuid[]) to authenticated;
