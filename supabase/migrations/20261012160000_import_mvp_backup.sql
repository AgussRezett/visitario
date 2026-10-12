-- =============================================================================
-- Import of an MVP backup (one person's own work) for a platform admin.
-- The data is already normalized by scripts/import-mvp-photos.mjs; photos are
-- uploaded afterwards through the photos function. Re-running is a no-op.
-- =============================================================================

-- The MVP did not require the storefront photo, so its finished visits may lack one.
-- Only the import function sets this flag (clients cannot SET through PostgREST).
create or replace function private.visit_finish_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('visitario.importing', true) = 'on' then return new; end if;
  if new.work_status in ('done', 'refused', 'closed') and new.work_status <> old.work_status then
    if not exists (select 1 from public.photo f
                   where f.visit_id = new.id and f.kind = 'storefront' and f.deleted_at is null) then
      raise exception 'A visit needs the storefront photo before it ends' using errcode = '23514';
    end if;
    if new.work_status = 'done' and coalesce(new.consent::text, '') not in ('yes', 'with_objection') then
      raise exception 'A finished visit needs the store''s consent' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create function public.import_mvp_backup(p_company uuid, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  j  jsonb := p_data;
begin
  if me is null or not private.is_platform_admin() then
    raise exception 'Only a platform admin can import an MVP backup' using errcode = '42501';
  end if;
  if not exists (select 1 from public.membership m
                 where m.company_id = p_company and m.person_id = me and m.status = 'active' and 'merchandiser' = any (m.roles)) then
    raise exception 'You are not an active merchandiser of this company' using errcode = '42501';
  end if;

  -- Run the rest as the system: the triggers keep the historic source, author and review.
  perform set_config('request.jwt.claims', '{}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('visitario.importing', 'on', true);

  insert into public.store (id, company_id, customer_number, name, address, area, lat, lng, location_status, source, created_by)
  select s.id, p_company, s.cn, s.name, s.address, s.area, s.lat, s.lng,
         case when s.lat is null then 'unverified' else 'verified' end::public.location_status, 'imported', me
  from jsonb_to_recordset(j->'stores') as s(id uuid, cn text, name text, address text, area text, lat float8, lng float8)
  on conflict (id) do nothing;

  insert into public.workday (id, company_id, merchandiser_id, work_date, status, created_by)
  select w.id, p_company, me, w.date, 'published', me
  from jsonb_to_recordset(j->'workdays') as w(id uuid, date date)
  on conflict (id) do nothing;

  insert into public.visit (id, company_id, workday_id, merchandiser_id, work_date, store_id, sort_order, task, source, added_by, resumed_from)
  select v.id, p_company, v.wd, me, v.date, v.store, v.sort, v.task, 'assigned', me, v.resumed
  from jsonb_to_recordset(j->'visits') as v(id uuid, wd uuid, date date, store uuid, sort int, task text, resumed uuid)
  order by v.date
  on conflict (id) do nothing;

  insert into public.display (id, company_id, visit_id, display_type_id, reference, source, sort_order, created_by)
  select x.id, p_company, x.visit, t.id, x.ref, x.source::public.display_source, x.sort, me
  from jsonb_to_recordset(j->'displays') as x(id uuid, visit uuid, type text, ref text, source text, sort int)
  join public.display_type t on t.company_id = p_company and t.name = x.type
  on conflict do nothing;

  insert into public.photo (id, company_id, visit_id, display_id, kind, taken_at, bytes, width, height, created_by)
  select p.id, p_company, p.visit, p.display, p.kind::public.photo_kind, p.taken, p.bytes, p.w, p.h, me
  from jsonb_to_recordset(j->'photos') as p(id uuid, visit uuid, display uuid, kind text, taken timestamptz, bytes int, w int, h int)
  on conflict (id) do nothing;

  insert into public.visit_metric (company_id, visit_id, metric_id, quantity)
  select p_company, m.visit, wm.id, m.qty
  from jsonb_to_recordset(j->'metrics') as m(visit uuid, metric text, qty int)
  join public.work_metric wm on wm.company_id = p_company and wm.name = m.metric
  on conflict do nothing;

  insert into public.visit_brand (company_id, visit_id, brand_id)
  select p_company, b.visit, br.id
  from jsonb_to_recordset(j->'brands') as b(visit uuid, brand text)
  join public.brand br on br.company_id = p_company and br.name = b.brand
  on conflict do nothing;

  update public.visit v set arrived_at = x.arrived, consent = x.consent::public.consent_kind, objection = x.objection, notes = x.notes
  from jsonb_to_recordset(j->'visits') as x(id uuid, arrived timestamptz, consent text, objection text, notes text)
  where v.id = x.id and v.company_id = p_company and v.work_status = 'pending';
  update public.visit v set work_status = 'in_progress'
  from jsonb_to_recordset(j->'visits') as x(id uuid, status text)
  where v.id = x.id and v.company_id = p_company and x.status in ('in_progress', 'done') and v.work_status = 'pending';
  update public.visit v set work_status = 'done', finished_at = x.finished
  from jsonb_to_recordset(j->'visits') as x(id uuid, status text, finished timestamptz)
  where v.id = x.id and v.company_id = p_company and x.status = 'done' and v.work_status = 'in_progress';
  update public.visit v set review_status = 'approved'
  from jsonb_to_recordset(j->'visits') as x(id uuid, approved boolean)
  where v.id = x.id and v.company_id = p_company and x.approved and v.review_status = 'unreviewed';

  return jsonb_build_object(
    'workdays', (select count(*) from public.workday w where w.id in (select (e->>'id')::uuid from jsonb_array_elements(j->'workdays') e)),
    'visits', (select count(*) from public.visit v where v.id in (select (e->>'id')::uuid from jsonb_array_elements(j->'visits') e)),
    'photos', (select count(*) from public.photo f where f.id in (select (e->>'id')::uuid from jsonb_array_elements(j->'photos') e))
  );
end $$;

revoke all on function public.import_mvp_backup from public, anon;
grant execute on function public.import_mvp_backup to authenticated;
