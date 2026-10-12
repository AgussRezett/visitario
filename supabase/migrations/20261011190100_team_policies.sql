-- Split the team admin policy so SELECT is evaluated by a single permissive policy
-- (Supabase advisor: multiple_permissive_policies).
drop policy team_admin on public.team;
create policy team_admin_insert on public.team for insert to authenticated
  with check (company_id in (select private.companies_with_role('admin')));
create policy team_admin_update on public.team for update to authenticated
  using (company_id in (select private.companies_with_role('admin')))
  with check (company_id in (select private.companies_with_role('admin')));
create policy team_admin_delete on public.team for delete to authenticated
  using (company_id in (select private.companies_with_role('admin')));
