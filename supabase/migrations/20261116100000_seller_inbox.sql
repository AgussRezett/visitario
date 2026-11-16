-- =============================================================================
-- The seller in the loop: they see the novedades of their clients (and close them: "Pedido
-- cargado", "No corresponde"), and the "después" photos of their clients' activations.
-- A client is a store whose seller is linked to the caller (private.map_scope).
-- =============================================================================

-- Is this store one of my clients, as a seller?
create function private.is_my_client(p_store uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.store s
    where s.id = p_store and s.deleted_at is null and s.seller_id is not null
      and s.seller_id = any ((select m.seller_ids from private.map_scope(s.company_id) m)::integer[]))
$$;
revoke all on function private.is_my_client(uuid) from public, anon;
grant execute on function private.is_my_client(uuid) to authenticated;

-- Novedades: also seen by the store's seller.
drop policy store_issue_select on public.store_issue;
create policy store_issue_select on public.store_issue for select to authenticated
  using (company_id in (select private.my_companies())
         and (private.visit_role(visit_id) is not null or private.is_my_client(store_id)));

-- Resolved by a supervisor or admin who sees the visit, or by the store's seller.
create or replace function public.resolve_store_issue(p_issue uuid, p_resolved boolean default true, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.store_issue%rowtype;
  boss boolean;
  seller boolean;
begin
  select * into i from public.store_issue where id = p_issue and deleted_at is null;
  if not found then
    raise exception 'Novedad not found' using errcode = 'P0002';
  end if;
  boss := private.visit_role(i.visit_id) is not null
    and (i.company_id in (select private.companies_with_role('supervisor')) or i.company_id in (select private.companies_with_role('admin')));
  seller := private.is_my_client(i.store_id);
  if not boss and not seller then
    if private.visit_role(i.visit_id) is null then
      raise exception 'Novedad not found' using errcode = 'P0002';
    end if;
    raise exception 'Only a supervisor, an admin or the store''s seller resolves a novedad' using errcode = '42501';
  end if;
  update public.store_issue set
    status = case when p_resolved then 'resolved'::public.issue_status else 'open'::public.issue_status end,
    resolved_by = case when p_resolved then private.current_person_id() end,
    resolved_at = case when p_resolved then now() end,
    resolution = case when p_resolved then left(nullif(btrim(p_note), ''), 300) end
  where id = p_issue;
end $$;

-- Photos: the activador's store history, and a seller's clients (finished activations).
create or replace function public.history_photos(p_ids uuid[])
returns table (id uuid, company_id uuid, visit_id uuid)
language sql stable security definer set search_path = '' as $$
  select f.id, f.company_id, f.visit_id
  from public.photo f
  join public.visit v on v.id = f.visit_id
  where f.id = any (p_ids) and f.deleted_at is null and f.uploaded_at is not null
    and (private.in_my_store_history(f.visit_id)
         or (v.deleted_at is null and v.work_status in ('done', 'refused', 'closed') and private.is_my_client(v.store_id)))
$$;

-- A client's history, now with each activation's "después" photos (to see the work done).
create or replace function public.client_history(p_company uuid, p_store uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with scope as (select * from private.map_scope(p_company)),
  st as (
    select s.* from public.store s, scope
    where s.id = p_store and s.company_id = p_company and s.deleted_at is null
      and (scope.all_stores or s.seller_id = any (scope.seller_ids))
  ),
  counted as (
    select v.* from public.visit v
    where v.store_id = p_store and v.company_id = p_company and v.deleted_at is null and exists (select 1 from st)
      and not exists (select 1 from public.visit c where c.resumed_from = v.id and c.deleted_at is null)
      and (v.work_status <> 'pending' or exists (select 1 from public.workday w where w.id = v.workday_id and w.status <> 'draft'))
    order by v.work_date desc, v.sort_order desc
    limit 30
  )
  select case when not exists (select 1 from st) then null else jsonb_build_object(
    'store', (select jsonb_build_object('id', s.id, 'name', s.name, 'address', s.address, 'area', s.area,
              'customer_number', s.customer_number, 'lat', s.lat, 'lng', s.lng, 'channel_id', s.channel_id, 'seller_id', s.seller_id) from st s),
    'visits', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'date', v.work_date, 'status', v.work_status, 'review', v.review_status, 'consent', v.consent,
        'merchandiser', (select p.first_name || ' ' || p.last_name from public.person p where p.id = v.merchandiser_id),
        'displays', coalesce((select jsonb_agg(t.name order by d.sort_order) from public.display d
                              join public.display_type t on t.id = d.display_type_id
                              where d.visit_id = v.id and d.deleted_at is null), '[]'::jsonb),
        'metrics', coalesce((select jsonb_agg(jsonb_build_object('name', w.name, 'quantity', m.quantity) order by w.sort_order)
                             from public.visit_metric m join public.work_metric w on w.id = m.metric_id
                             where m.visit_id = v.id and m.quantity > 0), '[]'::jsonb),
        'photos', case when v.work_status in ('done', 'refused', 'closed') then coalesce((
                    select jsonb_agg(jsonb_build_object('id', f.id, 'width', f.width, 'height', f.height, 'crop', f.crop) order by f.sort_order, f.taken_at)
                    from public.photo f
                    where f.visit_id = v.id and f.kind = 'after' and f.deleted_at is null and f.uploaded_at is not null), '[]'::jsonb)
                  else '[]'::jsonb end)
        order by v.work_date desc, v.sort_order desc) from counted v), '[]'::jsonb)) end;
$$;
