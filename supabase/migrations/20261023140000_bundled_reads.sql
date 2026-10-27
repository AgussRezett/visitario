-- =============================================================================
-- Two reads the app makes together every time, in one request each:
--   · my_identity(): who I am (person, private data, memberships, platform admin,
--     invitations by email, whether I have a password). Was 6 requests, partly in a row.
--   · company_catalogs(): what a company's screens need (brands, display types, work
--     numbers, templates, WhatsApp settings, channels, sellers). Was 7 requests.
-- Security invoker: each part reads under the same policies as before.
-- =============================================================================

create function public.my_identity() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'has_password', public.has_password(),
    'person', case when p.id is null then null else jsonb_build_object(
      'id', p.id, 'first_name', p.first_name, 'last_name', p.last_name,
      'dni', pp.dni, 'phone', pp.phone, 'birth_date', pp.birth_date) end,
    'memberships', case when p.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'company_id', m.company_id, 'roles', m.roles, 'status', m.status, 'starts_on', m.starts_on,
        'company', case when c.id is null then null else jsonb_build_object('name', c.name, 'kind', c.kind) end))
      from public.membership m
      left join public.company c on c.id = m.company_id
      where m.person_id = p.id), '[]'::jsonb) end,
    'is_platform_admin', p.id is not null and exists (select 1 from public.platform_admin a where a.person_id = p.id),
    'invitations', case when p.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(to_jsonb(i)) from public.my_invitations() i), '[]'::jsonb) end)
  from (select 1) one
  left join public.person p on p.auth_user_id = auth.uid()
  left join public.person_private pp on pp.person_id = p.id;
$$;

create function public.company_catalogs(p_company uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'brands', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.sort_order, b.name)
                        from public.brand b where b.company_id = p_company and b.active), '[]'::jsonb),
    'display_types', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.sort_order, t.name)
                               from public.display_type t where t.company_id = p_company and t.active), '[]'::jsonb),
    'metrics', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'report_label', w.report_label) order by w.sort_order)
                         from public.work_metric w where w.company_id = p_company and w.active), '[]'::jsonb),
    'templates', coalesce((select jsonb_agg(jsonb_build_object('kind', m.kind, 'body', m.body))
                           from public.message_template m where m.company_id = p_company), '[]'::jsonb),
    'company', (select jsonb_build_object('show_whatsapp', c.show_whatsapp, 'messages_per_display', c.messages_per_display)
                from public.company c where c.id = p_company),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'active', h.active, 'sort_order', h.sort_order) order by h.sort_order, h.name)
                          from public.channel h where h.company_id = p_company), '[]'::jsonb),
    'sellers', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'person_id', s.person_id, 'active', s.active) order by s.name)
                         from public.seller s where s.company_id = p_company), '[]'::jsonb));
$$;

revoke all on function public.my_identity() from public, anon;
revoke all on function public.company_catalogs(uuid) from public, anon;
grant execute on function public.my_identity() to authenticated;
grant execute on function public.company_catalogs(uuid) to authenticated;
