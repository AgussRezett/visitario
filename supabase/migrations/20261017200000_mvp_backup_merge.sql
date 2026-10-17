-- =============================================================================
-- MVP backup import that merges into what is already in Visitario:
--   · a day that already has a workday (made in v2, or by a supervisor) gets the
--     backup's stops in that workday instead of failing on the duplicate date;
--   · a store already in the directory is reused: by the id of an earlier import, by
--     customer number, or by the same address; only the others are created;
--   · a stop whose store is already in that day's workday is skipped, with its
--     displays, photos, work and brands. The result lists the skipped ones, so the
--     script does not upload their photos.
-- Visits of archived stores can be imported (they are history): the store_active
-- guard lets the import through. Re-running is still a no-op.
-- =============================================================================

create or replace function private.visit_store_active() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('visitario.importing', true), '') = 'on' then return new; end if;
  if exists (select 1 from public.store s where s.id = new.store_id and s.deleted_at is not null) then
    raise exception 'The store is archived' using errcode = '23514';
  end if;
  return new;
end $$;

create or replace function public.import_mvp_backup(p_company uuid, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
  j  jsonb := p_data;
  skipped jsonb;
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

  -- Working tables live until the end of this call's transaction (on commit drop).
  -- ---- Stores: reuse what the directory has, create the rest
  create temp table mvp_store on commit drop as
  select s.id as src, s.cn, s.name, s.address, s.area, s.lat, s.lng, null::uuid as dst
  from jsonb_to_recordset(j->'stores') as s(id uuid, cn text, name text, address text, area text, lat float8, lng float8);

  update mvp_store m set dst = st.id                                  -- an earlier import
  from public.store st where st.id = m.src and st.company_id = p_company;
  update mvp_store m set dst = st.id                                  -- the same customer
  from public.store st
  where m.dst is null and m.cn is not null and st.company_id = p_company and st.deleted_at is null and st.customer_number = m.cn;
  update mvp_store m set dst = (select st.id from public.store st     -- the same address
                                where st.company_id = p_company and st.deleted_at is null
                                  and private.normalize(st.address) = private.normalize(m.address)
                                order by st.id limit 1)
  where m.dst is null;

  insert into public.store (id, company_id, customer_number, name, address, area, lat, lng, location_status, source, created_by)
  select m.src, p_company, m.cn, m.name, m.address, m.area, m.lat, m.lng,
         case when m.lat is null then 'unverified' else 'verified' end::public.location_status, 'imported', me
  from mvp_store m where m.dst is null;
  update mvp_store set dst = src where dst is null;

  -- ---- Workdays: the day's existing one, or the backup's
  create temp table mvp_day on commit drop as
  select w.id as src, w.date,
         coalesce((select x.id from public.workday x
                   where x.company_id = p_company and x.merchandiser_id = me and x.work_date = w.date), w.id) as dst
  from jsonb_to_recordset(j->'workdays') as w(id uuid, date date);

  insert into public.workday (id, company_id, merchandiser_id, work_date, status, created_by)
  select d.src, p_company, me, d.date, 'published', me from mvp_day d where d.dst = d.src
  on conflict (id) do nothing;
  update public.workday w set deleted_at = null
  from mvp_day d where w.id = d.dst and w.deleted_at is not null;

  -- ---- Visits: skip a store the day already has (unless it is this same visit)
  create temp table mvp_visit on commit drop as
  select v.id, v.wd, v.date, s.dst as store, d.dst as day, v.sort, v.task, v.resumed,
         exists (select 1 from public.visit x where x.id = v.id) as done_before,
         (select x.id from public.visit x
          where x.workday_id = d.dst and x.store_id = s.dst and x.deleted_at is null and x.id <> v.id
          order by x.sort_order limit 1) as already
  from jsonb_to_recordset(j->'visits') as v(id uuid, wd uuid, date date, store uuid, sort int, task text, resumed uuid)
  join mvp_store s on s.src = v.store
  join mvp_day d on d.src = v.wd;
  delete from mvp_visit where done_before;  -- imported before: nothing to add, nothing skipped

  select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'date', v.date, 'address', st.address) order by v.date, v.sort), '[]')
  into skipped
  from mvp_visit v join public.store st on st.id = v.store
  where v.already is not null;

  -- Added after what the day already has, in the backup's order.
  insert into public.visit (id, company_id, workday_id, merchandiser_id, work_date, store_id, sort_order, task, source, added_by, resumed_from)
  select v.id, p_company, v.day, me, v.date, v.store,
         (row_number() over (partition by v.day order by v.sort))::int - 1
           + coalesce((select max(x.sort_order) + 1 from public.visit x where x.workday_id = v.day and x.id not in (select id from mvp_visit)), 0),
         v.task, 'assigned', me,
         -- A resumed visit points to what stands for its original: the original, or the stop that replaced it.
         case
           when v.resumed is null then null
           when exists (select 1 from mvp_visit o where o.id = v.resumed)
             then (select coalesce(o.already, o.id) from mvp_visit o where o.id = v.resumed)  -- in this same backup
           else (select x.id from public.visit x where x.id = v.resumed)                        -- imported before, or gone
         end
  from mvp_visit v
  where v.already is null
  order by v.date;

  create temp table mvp_skip on commit drop as select id from mvp_visit where already is not null;

  insert into public.display (id, company_id, visit_id, display_type_id, reference, source, sort_order, created_by)
  select x.id, p_company, x.visit, t.id, x.ref, x.source::public.display_source, x.sort, me
  from jsonb_to_recordset(j->'displays') as x(id uuid, visit uuid, type text, ref text, source text, sort int)
  join public.display_type t on t.company_id = p_company and t.name = x.type
  where x.visit not in (select id from mvp_skip)
  on conflict do nothing;

  insert into public.photo (id, company_id, visit_id, display_id, kind, taken_at, bytes, width, height, created_by)
  select p.id, p_company, p.visit, p.display, p.kind::public.photo_kind, p.taken, p.bytes, p.w, p.h, me
  from jsonb_to_recordset(j->'photos') as p(id uuid, visit uuid, display uuid, kind text, taken timestamptz, bytes int, w int, h int)
  where p.visit not in (select id from mvp_skip)
  on conflict (id) do nothing;

  insert into public.visit_metric (company_id, visit_id, metric_id, quantity)
  select p_company, m.visit, wm.id, m.qty
  from jsonb_to_recordset(j->'metrics') as m(visit uuid, metric text, qty int)
  join public.work_metric wm on wm.company_id = p_company and wm.name = m.metric
  where m.visit not in (select id from mvp_skip)
  on conflict do nothing;

  insert into public.visit_brand (company_id, visit_id, brand_id)
  select p_company, b.visit, br.id
  from jsonb_to_recordset(j->'brands') as b(visit uuid, brand text)
  join public.brand br on br.company_id = p_company and br.name = b.brand
  where b.visit not in (select id from mvp_skip)
  on conflict do nothing;

  -- How each visit ended (skipped ones do not exist, so these leave them alone).
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
    'workdays', (select count(distinct dst) from mvp_day),
    'merged_days', (select count(*) from mvp_day where dst <> src),
    'stores_reused', (select count(*) from mvp_store where dst <> src),
    'visits', (select count(*) from public.visit v where v.id in (select (e->>'id')::uuid from jsonb_array_elements(j->'visits') e)),
    'photos', (select count(*) from public.photo f where f.id in (select (e->>'id')::uuid from jsonb_array_elements(j->'photos') e)),
    'skipped', skipped
  );
end $$;
