-- =============================================================================
-- Visitario v2 · Initial schema (3/4): row level security and column grants
-- =============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'person', 'person_private', 'platform_admin', 'company', 'subscription', 'team', 'membership',
    'brand', 'display_type', 'work_metric', 'message_template', 'import_format',
    'store', 'workday', 'visit', 'display', 'photo', 'visit_metric', 'visit_brand',
    'comment', 'visit_event', 'support_access', 'dni_lookup', 'ai_usage'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Person: myself, and people I share a company with (names only).
create policy person_select on public.person for select to authenticated using (
  auth_user_id = (select auth.uid())
  or id in (select m.person_id from public.membership m where m.company_id in (select private.my_companies()))
  or (select private.is_platform_admin())
);
create policy person_update on public.person for update to authenticated
  using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));
grant select, update (first_name, last_name) on public.person to authenticated;

create policy person_private_select on public.person_private for select to authenticated
  using (person_id = (select private.current_person_id()));
create policy person_private_update on public.person_private for update to authenticated
  using (person_id = (select private.current_person_id())) with check (person_id = (select private.current_person_id()));
grant select, update (birth_date) on public.person_private to authenticated;

create policy platform_admin_self on public.platform_admin for select to authenticated
  using (person_id = (select private.current_person_id()));
grant select on public.platform_admin to authenticated;

-- Company
create policy company_select on public.company for select to authenticated
  using (id in (select private.my_companies()) or (select private.is_platform_admin()));
create policy company_update on public.company for update to authenticated
  using (id in (select private.companies_with_role('admin'))) with check (id in (select private.companies_with_role('admin')));
grant select, update (name, timezone, geocoding_scope, logo_version, require_before_after,
                      require_shelf_facings, show_whatsapp, photo_retention_months) on public.company to authenticated;

create policy subscription_select on public.subscription for select to authenticated
  using (company_id in (select private.companies_with_role('admin')) or (select private.is_platform_admin()));
grant select on public.subscription to authenticated;

-- Team and membership
create policy team_select on public.team for select to authenticated
  using (company_id in (select private.my_companies()));
create policy team_admin on public.team for all to authenticated
  using (company_id in (select private.companies_with_role('admin'))) with check (company_id in (select private.companies_with_role('admin')));
grant select, insert, update, delete on public.team to authenticated;

create policy membership_select on public.membership for select to authenticated using (
  person_id = (select private.current_person_id())
  or company_id in (select private.my_companies())
  or (select private.is_platform_admin())
);
create policy membership_admin on public.membership for update to authenticated
  using (company_id in (select private.companies_with_role('admin'))) with check (company_id in (select private.companies_with_role('admin')));
grant select, update (roles, team_id, status, starts_on) on public.membership to authenticated;
-- New memberships only through invite_person(). Accepting: respond_invitation().

-- Catalogs and settings: any member reads them, admins edit them.
do $$
declare t text;
begin
  foreach t in array array['brand', 'display_type', 'work_metric', 'message_template'] loop
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
                      using (company_id in (select private.my_companies()))$f$, t);
    execute format($f$create policy %1$s_admin_insert on public.%1$I for insert to authenticated
                      with check (company_id in (select private.companies_with_role('admin')))$f$, t);
    execute format($f$create policy %1$s_admin_update on public.%1$I for update to authenticated
                      using (company_id in (select private.companies_with_role('admin')))
                      with check (company_id in (select private.companies_with_role('admin')))$f$, t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
  end loop;
end $$;

create policy import_format_all on public.import_format for all to authenticated
  using (company_id in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')))
  with check (company_id in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')));
grant select, insert, update, delete on public.import_format to authenticated;

-- Store: any member reads and creates (merchandisers add stores); supervisors and admins edit.
create policy store_select on public.store for select to authenticated
  using (company_id in (select private.my_companies()));
create policy store_insert on public.store for insert to authenticated
  with check (company_id in (select private.my_companies()) and created_by = (select private.current_person_id()));
create policy store_update on public.store for update to authenticated
  using (company_id in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')))
  with check (company_id in (select private.companies_with_role('supervisor') union select private.companies_with_role('admin')));
grant select, insert, update on public.store to authenticated;

-- Workday: within my scope. A merchandiser does not see drafts a supervisor is building.
create policy workday_select on public.workday for select to authenticated using (
  (company_id, merchandiser_id) in (select * from private.visible_merchandisers())
  and (merchandiser_id <> (select private.current_person_id()) or status <> 'draft' or created_by = (select private.current_person_id()))
);
create policy workday_insert on public.workday for insert to authenticated
  with check ((company_id, merchandiser_id) in (select * from private.visible_merchandisers()));
create policy workday_update on public.workday for update to authenticated
  using ((company_id, merchandiser_id) in (select * from private.visible_merchandisers()))
  with check ((company_id, merchandiser_id) in (select * from private.visible_merchandisers()));
grant select, insert, update on public.workday to authenticated;

-- Visit: scope by (company, merchandiser) copied onto the row; no joins except for drafts.
create policy visit_select on public.visit for select to authenticated using (
  (company_id, merchandiser_id) in (select * from private.visible_merchandisers())
  and (merchandiser_id <> (select private.current_person_id())
       or exists (select 1 from public.workday w where w.id = workday_id
                  and (w.status <> 'draft' or w.created_by = (select private.current_person_id()))))
);
create policy visit_insert on public.visit for insert to authenticated
  with check (exists (select 1 from public.workday w where w.id = workday_id and w.company_id = visit.company_id));
create policy visit_update on public.visit for update to authenticated
  using ((company_id, merchandiser_id) in (select * from private.visible_merchandisers()))
  with check ((company_id, merchandiser_id) in (select * from private.visible_merchandisers()));
grant select, insert,
      update (store_id, sort_order, task, work_status, review_status, arrived_at, consent, objection,
              retry_after, finished_at, notes, deleted_at)
  on public.visit to authenticated;

-- Visit children: visible when the visit is visible (the visit policy applies inside).
do $$
declare t text;
begin
  foreach t in array array['display', 'photo', 'visit_metric', 'visit_brand', 'comment', 'visit_event'] loop
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
                      using (exists (select 1 from public.visit v where v.id = visit_id))$f$, t);
  end loop;
  foreach t in array array['display', 'photo', 'visit_metric', 'visit_brand'] loop
    execute format($f$create policy %1$s_insert on public.%1$I for insert to authenticated
                      with check (exists (select 1 from public.visit v where v.id = visit_id and v.company_id = %1$I.company_id))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$I for update to authenticated
                      using (exists (select 1 from public.visit v where v.id = visit_id))
                      with check (exists (select 1 from public.visit v where v.id = visit_id))$f$, t);
  end loop;
end $$;
create policy visit_metric_delete on public.visit_metric for delete to authenticated
  using (exists (select 1 from public.visit v where v.id = visit_id));
create policy visit_brand_delete on public.visit_brand for delete to authenticated
  using (exists (select 1 from public.visit v where v.id = visit_id));
grant select, insert, update (display_type_id, reference, sort_order, deleted_at) on public.display to authenticated;
grant select, insert, update (sort_order, deleted_at) on public.photo to authenticated;
grant select, insert, update (quantity), delete on public.visit_metric to authenticated;
grant select, insert, delete on public.visit_brand to authenticated;

-- Comments: immutable; the author is always me.
create policy comment_insert on public.comment for insert to authenticated with check (
  author_id = (select private.current_person_id())
  and exists (select 1 from public.visit v where v.id = visit_id and v.company_id = comment.company_id)
);
grant select, insert on public.comment to authenticated;

grant select on public.visit_event to authenticated;

-- Support access: platform admins, and the company admin for transparency.
create policy support_access_select on public.support_access for select to authenticated
  using ((select private.is_platform_admin()) or company_id in (select private.companies_with_role('admin')));
create policy support_access_insert on public.support_access for insert to authenticated
  with check ((select private.is_platform_admin()) and admin_id = (select private.current_person_id()));
grant select, insert on public.support_access to authenticated;

create policy ai_usage_select on public.ai_usage for select to authenticated
  using (company_id in (select private.companies_with_role('admin')) or (select private.is_platform_admin()));
grant select on public.ai_usage to authenticated;

create policy dni_lookup_select on public.dni_lookup for select to authenticated
  using ((select private.is_platform_admin()));
grant select on public.dni_lookup to authenticated;
