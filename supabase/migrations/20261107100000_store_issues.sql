-- =============================================================================
-- Novedades: what an activador finds at a store and the supervisor should know (it needs
-- an order, no stock, no price, a competitor's action...). Reported from the visit (also
-- without signal), they wait in the supervisor's inbox until marked resolved.
--   issue_type:  the kinds, a company catalog the admin edits (seeded with the usual ones).
--   store_issue: one report, of a store, from a visit.
-- Seen by whoever sees the visit (its activador, their supervisors, the admins).
-- =============================================================================

create table public.issue_type (
  id          integer generated always as identity primary key,
  company_id  uuid not null references public.company (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  active      boolean not null default true,
  sort_order  smallint not null default 0,
  updated_at  timestamptz not null default now(),
  unique (company_id, id),
  unique (company_id, name)
);
comment on table public.issue_type is 'Kinds of novedad (Necesita pedido, Falta de stock...). Never deleted: deactivated.';

alter table public.issue_type enable row level security;
alter table public.issue_type force row level security;
revoke all on public.issue_type from anon, authenticated;
create policy issue_type_select on public.issue_type for select to authenticated
  using (company_id in (select private.my_companies()));
create policy issue_type_admin_insert on public.issue_type for insert to authenticated
  with check (company_id in (select private.companies_with_role('admin')));
create policy issue_type_admin_update on public.issue_type for update to authenticated
  using (company_id in (select private.companies_with_role('admin')))
  with check (company_id in (select private.companies_with_role('admin')));
grant select, insert, update on public.issue_type to authenticated;

-- The usual kinds, for every company (new ones too).
create function private.seed_issue_types(p_company uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.issue_type (company_id, name, sort_order)
  select p_company, t.name, t.n
  from unnest(array['Necesita pedido', 'Falta de stock', 'Sin precio o precio mal', 'Mal ubicado o junto a la competencia',
                    'Acción de la competencia', 'Local cerrado o no quiere activar', 'Otro']) with ordinality as t (name, n)
  on conflict (company_id, name) do nothing;
$$;
create function private.company_seed_issue_types() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.seed_issue_types(new.id);
  return null;
end $$;
create trigger seed_issue_types after insert on public.company for each row execute function private.company_seed_issue_types();
select private.seed_issue_types(c.id) from public.company c;

create type public.issue_status as enum ('open', 'resolved');

create table public.store_issue (
  id           uuid primary key,  -- from the phone: sending it twice does not duplicate
  company_id   uuid not null,
  store_id     uuid not null,
  visit_id     uuid not null,
  type_id      integer not null,
  note         text check (note is null or char_length(note) <= 500),
  status       public.issue_status not null default 'open',
  created_by   uuid not null references public.person (id) on delete restrict,
  resolved_by  uuid references public.person (id) on delete set null,
  resolved_at  timestamptz,
  resolution   text check (resolution is null or char_length(resolution) <= 300),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  version      integer not null default 1,
  deleted_at   timestamptz,
  foreign key (company_id, visit_id) references public.visit (company_id, id) on delete cascade,
  foreign key (company_id, store_id) references public.store (company_id, id),
  foreign key (company_id, type_id) references public.issue_type (company_id, id)
);
create index store_issue_inbox on public.store_issue (company_id, status, created_at desc) where deleted_at is null;
create index store_issue_store on public.store_issue (store_id) where deleted_at is null;
create index store_issue_visit on public.store_issue (visit_id);
create trigger touch before insert or update on public.store_issue for each row execute function private.touch();

-- Who reports it, which store and that it starts open come from the server, not the phone.
create function private.store_issue_on_create() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := private.current_person_id();
begin
  if me is null then return new; end if;
  if private.visit_role(new.visit_id) is null then
    raise exception 'No permission on this visit' using errcode = '42501';
  end if;
  select v.company_id, v.store_id into new.company_id, new.store_id from public.visit v where v.id = new.visit_id;
  new.created_by := me;
  new.status := 'open';
  new.resolved_by := null; new.resolved_at := null; new.resolution := null; new.deleted_at := null;
  new.note := nullif(btrim(new.note), '');
  return new;
end $$;
create trigger on_create before insert on public.store_issue for each row execute function private.store_issue_on_create();

alter table public.store_issue enable row level security;
alter table public.store_issue force row level security;
revoke all on public.store_issue from anon, authenticated;
create policy store_issue_select on public.store_issue for select to authenticated
  using (company_id in (select private.my_companies()) and private.visit_role(visit_id) is not null);
create policy store_issue_insert on public.store_issue for insert to authenticated
  with check (company_id in (select private.my_companies()) and private.visit_role(visit_id) is not null);
-- Changes only through the functions below.
grant select, insert (id, company_id, store_id, visit_id, type_id, note) on public.store_issue to authenticated;

-- A supervisor or admin who sees the visit resolves it (with an optional note) or opens it again.
create function public.resolve_store_issue(p_issue uuid, p_resolved boolean default true, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.store_issue%rowtype;
begin
  select * into i from public.store_issue where id = p_issue and deleted_at is null;
  if not found or private.visit_role(i.visit_id) is null then
    raise exception 'Novedad not found' using errcode = 'P0002';
  end if;
  if not (i.company_id in (select private.companies_with_role('supervisor')) or i.company_id in (select private.companies_with_role('admin'))) then
    raise exception 'Only a supervisor or an admin resolves a novedad' using errcode = '42501';
  end if;
  update public.store_issue set
    status = case when p_resolved then 'resolved'::public.issue_status else 'open'::public.issue_status end,
    resolved_by = case when p_resolved then private.current_person_id() end,
    resolved_at = case when p_resolved then now() end,
    resolution = case when p_resolved then left(nullif(btrim(p_note), ''), 300) end
  where id = p_issue;
end $$;

-- Whoever reported it takes it back while it is open (a mistake). Safe to call twice.
create function public.remove_store_issue(p_issue uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.store_issue set deleted_at = now()
  where id = p_issue and created_by = private.current_person_id() and status = 'open' and deleted_at is null;
end $$;

revoke all on function public.resolve_store_issue(uuid, boolean, text) from public, anon;
revoke all on function public.remove_store_issue(uuid) from public, anon;
grant execute on function public.resolve_store_issue(uuid, boolean, text) to authenticated;
grant execute on function public.remove_store_issue(uuid) to authenticated;

-- The kinds travel with the other catalogs (inactive too: old reports keep their name).
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
    'company', (select jsonb_build_object('show_whatsapp', c.show_whatsapp, 'messages_per_display', c.messages_per_display)
                from public.company c where c.id = p_company),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'active', h.active, 'sort_order', h.sort_order) order by h.sort_order, h.name)
                          from public.channel h where h.company_id = p_company), '[]'::jsonb),
    'sellers', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'person_id', s.person_id, 'active', s.active) order by s.name)
                         from public.seller s where s.company_id = p_company), '[]'::jsonb),
    'issue_types', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'active', k.active) order by k.sort_order, k.name)
                             from public.issue_type k where k.company_id = p_company), '[]'::jsonb));
$$;

-- The inbox updates by itself.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.store_issue;
  end if;
end $$;
