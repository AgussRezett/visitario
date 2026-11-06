-- Cropping a photo, optional and undoable: the file stays as taken and the photo keeps the
-- part to show ({x, y, w, h}, fractions of the picture). The merchandiser crops in their
-- visit until it is approved; a supervisor or admin crops any visit they can see (approved
-- ones too: the presentation for the brand is made of approved visits).

alter table public.photo add column crop real[]
  check (crop is null or (cardinality(crop) = 4
    and crop[1] >= 0 and crop[2] >= 0 and crop[3] >= 0.05 and crop[4] >= 0.05
    and crop[1] + crop[3] <= 1.0001 and crop[2] + crop[4] <= 1.0001));

-- Visit children: the same rules as before, plus the crop written by set_photo_crop (only
-- that column; the function checks who may).
create or replace function private.visit_child_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me      uuid := private.current_person_id();
  vid     uuid;
  acting  text;
  review  public.review_status;
begin
  if me is null then  -- service_role (Edge Functions) or maintenance
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and tg_table_name = 'photo' and current_setting('visitario.photo_crop', true) = 'on'
     and (to_jsonb(new) - array['crop', 'updated_at', 'version']) = (to_jsonb(old) - array['crop', 'updated_at', 'version']) then
    return new;
  end if;
  if tg_op = 'DELETE' then vid := old.visit_id; else vid := new.visit_id; end if;
  if tg_op = 'UPDATE' and new.visit_id <> old.visit_id then
    raise exception 'A record cannot move to another visit' using errcode = '23514';
  end if;
  acting := private.visit_role(vid);
  if acting is null then
    raise exception 'No permission on this visit' using errcode = '42501';
  end if;
  select v.review_status into review from public.visit v where v.id = vid;
  if review = 'approved' then
    raise exception 'An approved visit is locked' using errcode = '42501';
  end if;
  if acting = 'supervisor' and tg_table_name in ('photo', 'visit_metric', 'visit_brand') then
    raise exception 'Photos and work are recorded by the merchandiser' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and tg_table_name = 'photo' then
    new.created_by := me;
    new.uploaded_at := null;  -- confirmed by the Edge Function after checking the file in R2
  elsif tg_op = 'INSERT' and tg_table_name = 'display' then
    new.created_by := me;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- Sets (or, with null or the whole picture, removes) a photo's crop.
create function public.set_photo_crop(p_photo uuid, p_crop real[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f       public.photo%rowtype;
  acting  text;
  review  public.review_status;
begin
  select * into f from public.photo where id = p_photo and deleted_at is null;
  if not found then
    raise exception 'Photo not found' using errcode = 'P0002';
  end if;
  acting := private.visit_role(f.visit_id);
  if acting is null then
    raise exception 'No permission on this visit' using errcode = '42501';
  end if;
  select v.review_status into review from public.visit v where v.id = f.visit_id;
  if acting = 'merchandiser' and review = 'approved'
     and not (f.company_id in (select private.companies_with_role('supervisor')) or f.company_id in (select private.companies_with_role('admin'))) then
    raise exception 'An approved visit is locked' using errcode = '42501';
  end if;
  if p_crop is not null and p_crop[1] <= 0.001 and p_crop[2] <= 0.001 and p_crop[3] >= 0.999 and p_crop[4] >= 0.999 then
    p_crop := null;  -- the whole picture: no crop
  end if;
  perform set_config('visitario.photo_crop', 'on', true);
  update public.photo set crop = p_crop where id = p_photo;
  perform set_config('visitario.photo_crop', 'off', true);
end $$;

revoke all on function public.set_photo_crop(uuid, real[]) from public, anon;
grant execute on function public.set_photo_crop(uuid, real[]) to authenticated;

-- The store's history shows the photos cropped too.
create or replace function public.history_visit(p_visit uuid) returns jsonb
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
                'uploaded_at', f.uploaded_at, 'deleted_at', f.deleted_at, 'width', f.width, 'height', f.height, 'crop', f.crop))
              from public.photo f where f.visit_id = v.id), '[]'),
    'metrics', coalesce((select jsonb_agg(jsonb_build_object('metric_id', x.metric_id, 'quantity', x.quantity)) from public.visit_metric x where x.visit_id = v.id), '[]'),
    'brands', coalesce((select jsonb_agg(b.brand_id) from public.visit_brand b where b.visit_id = v.id), '[]'))
  from public.visit v
  where v.id = p_visit and private.in_my_store_history(v.id)
$$;
