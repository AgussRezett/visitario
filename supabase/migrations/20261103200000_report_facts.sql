-- =============================================================================
-- Reports: the raw facts of a period, in one call, for the reports panel to count,
-- compare and project on the phone or the computer. Security invoker: each person gets
-- what they may see (a supervisor, their team; an admin, the company).
--
-- One row per visit (a visit moved to another day counts once, where it ended), its work
-- totals and brands, who did them, and every active store with its last visit (coverage).
-- At most a year per call.
-- =============================================================================
create function public.report_facts(p_company uuid, p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  with counted as (
    select v.* from public.visit v
    where v.company_id = p_company and v.deleted_at is null
      and v.work_date between p_from and least(p_to, p_from + 366)
      and not exists (select 1 from public.visit c where c.resumed_from = v.id and c.deleted_at is null)
  )
  select jsonb_build_object(
    'visits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', v.id, 'd', v.work_date, 'm', v.merchandiser_id, 's', v.store_id,
        'src', v.source, 'ws', v.work_status, 'rs', v.review_status, 'c', v.consent, 'r', v.rapport,
        'a', v.arrived_at, 'f', v.finished_at, 'res', v.resumed_from is not null,
        'area', s.area, 'ch', s.channel_id, 'se', s.seller_id,
        'dt', (select count(*) from public.display d where d.visit_id = v.id and d.deleted_at is null),
        'da', (select count(*) from public.display d where d.visit_id = v.id and d.deleted_at is null
                 and exists (select 1 from public.photo p where p.display_id = d.id and p.kind = 'after' and p.deleted_at is null)),
        'ph', (select count(*) from public.photo p where p.visit_id = v.id and p.deleted_at is null)
      ) order by v.work_date, v.merchandiser_id, v.sort_order)
      from counted v join public.store s on s.id = v.store_id), '[]'::jsonb),
    'metrics', coalesce((
      select jsonb_agg(jsonb_build_object('v', m.visit_id, 'id', m.metric_id, 'q', m.quantity))
      from public.visit_metric m join counted v on v.id = m.visit_id where m.quantity > 0), '[]'::jsonb),
    'brands', coalesce((
      select jsonb_agg(jsonb_build_object('v', b.visit_id, 'id', b.brand_id))
      from public.visit_brand b join counted v on v.id = b.visit_id), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'first', p.first_name, 'last', p.last_name) order by p.first_name)
      from public.person p where p.id in (select merchandiser_id from counted)), '[]'::jsonb),
    'stores', coalesce((
      select jsonb_agg(jsonb_build_object('s', s.id, 'name', coalesce(s.name, s.address), 'area', s.area, 'ch', s.channel_id, 'se', s.seller_id,
        'last', (select max(v.work_date) from public.visit v
                 where v.store_id = s.id and v.deleted_at is null and v.work_status in ('done', 'refused', 'closed') and v.work_date <= p_to)))
      from public.store s where s.company_id = p_company and s.deleted_at is null), '[]'::jsonb)
  );
$$;
comment on function public.report_facts is 'Raw facts of a period for the reports panel: visits, work totals, brands and the stores with their last visit.';
revoke all on function public.report_facts(uuid, date, date) from public, anon;
grant execute on function public.report_facts(uuid, date, date) to authenticated;
