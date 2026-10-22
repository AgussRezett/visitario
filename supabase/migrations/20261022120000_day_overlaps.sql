-- =============================================================================
-- Who else has this store that day: before a store goes into a workday, the person
-- adding it (activador or supervisor) learns if another day of the company already
-- has it. One row per stop found, matched by store, customer number or address.
--
-- Security definer: an activador cannot read other people's visits, so this answers
-- only the least needed (first names, who added it, how it is going) and only inside
-- the caller's own company. Draft days (not yet published) count only for those who
-- assign: supervisors and admins.
-- =============================================================================

create function public.day_overlaps(p_workday uuid, p_rows jsonb)
returns table (
  idx                   integer,
  visit_id              uuid,
  store_id              uuid,
  store_name            text,
  address               text,
  same_workday          boolean,
  merchandiser_first    text,
  merchandiser_last     text,
  added_by_first        text,
  added_by_merchandiser boolean,
  work_status           public.work_status
)
language plpgsql stable security definer set search_path = '' as $$
declare
  w       public.workday%rowtype;
  assigns boolean;
begin
  select * into w from public.workday where id = p_workday and deleted_at is null;
  if not found or w.company_id not in (select private.my_companies()) then
    return;
  end if;
  assigns := w.company_id in (select private.companies_with_role('supervisor'))
          or w.company_id in (select private.companies_with_role('admin'));

  return query
  select (r.ord - 1)::integer, v.id, s.id, s.name, s.address, v.workday_id = p_workday,
         m.first_name, m.last_name, a.first_name, v.added_by = v.merchandiser_id, v.work_status
  from jsonb_array_elements(case when jsonb_typeof(p_rows) = 'array' then p_rows else '[]' end) with ordinality as r (item, ord)
  join public.visit v on v.company_id = w.company_id and v.work_date = w.work_date and v.deleted_at is null
  join public.workday d on d.id = v.workday_id and d.deleted_at is null and (assigns or d.status <> 'draft')
  join public.store s on s.id = v.store_id
  join public.person m on m.id = v.merchandiser_id
  left join public.person a on a.id = v.added_by
  where r.ord <= 500
    and (
      s.id::text = r.item ->> 'store_id'
      or s.customer_number = nullif(btrim(r.item ->> 'customer_number'), '')
      or (char_length(btrim(coalesce(r.item ->> 'address', ''))) >= 3
          and private.normalize(s.address) = private.normalize(r.item ->> 'address'))
    )
  order by r.ord, v.workday_id = p_workday desc, m.first_name;
end $$;

revoke all on function public.day_overlaps(uuid, jsonb) from public, anon;
grant execute on function public.day_overlaps(uuid, jsonb) to authenticated;
