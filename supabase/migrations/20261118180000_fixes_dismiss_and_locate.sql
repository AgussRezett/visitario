-- "Descartar" yesterday's unfinished visits failed for anyone with an approved one among them:
-- an approved visit is locked, so marking it dismissed raised, and nothing was dismissed. An
-- approved visit has nothing left to resume: it is not offered, and dismissing skips it.

create or replace function public.resumable_visits(p_company uuid, p_before date)
returns table (visit_id uuid, work_date date, store_name text, address text, work_status public.work_status, finished_at timestamptz, pending_displays integer)
language sql stable set search_path = '' as $$
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
    and v.review_status <> 'approved'
    and s.deleted_at is null
    and v.work_status in ('pending', 'closed')
    and not exists (select 1 from public.visit r where r.resumed_from = v.id and r.deleted_at is null)
    and not exists (select 1 from public.visit n
                    where n.store_id = v.store_id and n.merchandiser_id = v.merchandiser_id
                      and n.work_date > v.work_date and n.deleted_at is null)
  order by v.work_date desc, v.sort_order;
$$;

create or replace function public.dismiss_resumable(p_visits uuid[])
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  update public.visit set resume_dismissed_at = now()
  where id = any (p_visits)
    and merchandiser_id = private.current_person_id()
    and work_status in ('pending', 'closed')
    and review_status <> 'approved'
    and resume_dismissed_at is null
    and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- What the supervisor can resume for someone: the same rule.
create or replace function public.merchandiser_pending(p_company uuid, p_merchandiser uuid, p_before date)
returns table (visit_id uuid, work_date date, store_name text, address text, work_status public.work_status, finished_at timestamptz, pending_displays integer)
language sql stable set search_path = '' as $$
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
    and v.review_status <> 'approved'
    and s.deleted_at is null
    and v.work_status in ('pending', 'closed')
    and not exists (select 1 from public.visit r where r.resumed_from = v.id and r.deleted_at is null)
    and not exists (select 1 from public.visit n
                    where n.store_id = v.store_id and n.merchandiser_id = v.merchandiser_id
                      and n.work_date > v.work_date and n.deleted_at is null)
  order by v.work_date desc, v.sort_order;
$$;

-- Locating stores by themselves failed for every store without a barrio: the geocoder fills it
-- in, and the trigger that tidies names runs private.tidy_text, which the server's role (the
-- one the geocoder saves with) may not call. Those stores never got their place. The trigger
-- now runs as its owner, as the other guards do.
alter function private.store_tidy() security definer;
alter function private.store_tidy() set search_path = '';
