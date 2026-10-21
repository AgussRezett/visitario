-- The day's operativos also say how their visits ended and how their review goes, so the
-- team's totals count each shared visit (and its work) once: it counts in every member's own row.
create or replace function public.day_operations(p_company uuid, p_date date)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.j order by x.created_at), '[]'::jsonb)
  from (
    select o.created_at, jsonb_build_object(
      'id', o.id, 'workday_id', o.workday_id, 'host_id', o.host_id, 'name', o.name, 'created_by', o.created_by,
      'created_at', o.created_at, 'ended_at', o.ended_at, 'workday_status', w.status,
      'members', (select jsonb_agg(jsonb_build_object('person_id', m.person_id, 'first_name', p.first_name, 'last_name', p.last_name,
                                                      'left_at', m.left_at, 'workday_id', m.workday_id) order by m.joined_at)
                  from public.operation_member m join public.person p on p.id = m.person_id where m.operation_id = o.id)
    ) || coalesce((
      select jsonb_build_object(
        'total', count(*),
        'visited', count(*) filter (where v.work_status in ('done', 'refused', 'closed')),
        'in_progress', count(*) filter (where v.work_status = 'in_progress'),
        'refused', count(*) filter (where v.work_status = 'refused'),
        'closed', count(*) filter (where v.work_status = 'closed'),
        'approved', count(*) filter (where v.review_status = 'approved'),
        'needs_fix', count(*) filter (where v.review_status = 'needs_fix'))
      from public.visit v where v.workday_id = o.workday_id and v.deleted_at is null), '{}'::jsonb)
    || jsonb_build_object('metrics', coalesce((
      select jsonb_object_agg(t.metric_id, t.quantity)
      from (select vm.metric_id, sum(vm.quantity)::integer as quantity
            from public.visit_metric vm join public.visit v on v.id = vm.visit_id
            where v.workday_id = o.workday_id and v.deleted_at is null group by vm.metric_id) t), '{}'::jsonb)) as j
    from public.operation o join public.workday w on w.id = o.workday_id
    where o.company_id = p_company and o.work_date = p_date and w.deleted_at is null
      and o.id in (select private.visible_operations())
      and (w.status <> 'draft' or o.created_by = private.current_person_id()
           or o.company_id in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')))
  ) x;
$$;
