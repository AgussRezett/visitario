-- How the ANTES and the DESPUÉS go to WhatsApp, each on its own:
--   'visit'   one message for the whole visit, with all its photos (as before, the default);
--   'display' one message per display (Puntera, Primaria 1, Primaria 2…);
--   'type'    one message per kind of display, with the photos of all of them (Puntera, Primarias, Góndolas).
-- They replace messages_per_display, which is kept for apps not updated yet.

alter table public.company
  add column messages_before text not null default 'visit' check (messages_before in ('visit', 'display', 'type')),
  add column messages_after text not null default 'visit' check (messages_after in ('visit', 'display', 'type'));
comment on column public.company.messages_before is 'ANTES messages: one per visit, per display or per kind of display.';
comment on column public.company.messages_after is 'DESPUÉS messages: one per visit, per display or per kind of display.';
update public.company set messages_before = 'display', messages_after = 'display' where messages_per_display;
grant update (messages_before, messages_after) on public.company to authenticated;

create or replace function public.company_catalogs(p_company uuid) returns jsonb
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
    'company', (select jsonb_build_object('show_whatsapp', c.show_whatsapp, 'messages_per_display', c.messages_per_display,
                                       'messages_before', c.messages_before, 'messages_after', c.messages_after)
                from public.company c where c.id = p_company),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'active', h.active, 'sort_order', h.sort_order) order by h.sort_order, h.name)
                          from public.channel h where h.company_id = p_company), '[]'::jsonb),
    'sellers', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'person_id', s.person_id, 'active', s.active) order by s.name)
                         from public.seller s where s.company_id = p_company), '[]'::jsonb),
    'issue_types', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'active', k.active) order by k.sort_order, k.name)
                             from public.issue_type k where k.company_id = p_company), '[]'::jsonb));
$$;
