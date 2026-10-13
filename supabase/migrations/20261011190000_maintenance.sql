-- =============================================================================
-- Visitario v2 · Maintenance
-- Kept separate: it hard-deletes old soft-deleted rows, so it is applied with the
-- Supabase CLI (or an approved migration), never by an agent tool silently.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Maintenance (scheduled with pg_cron). Returns every photo whose file must leave R2:
--   · past the company's retention (the row is marked deleted now),
--   · deleted by someone 30+ days ago, or of a visit deleted 30+ days ago (rows removed here).
-- Then hard-deletes what was soft-deleted 30+ days ago. Retention never changes how a visit
-- ended (see purge_keeps_history: the storefront rule is skipped while purging).
-- -----------------------------------------------------------------------------
create function private.purge() returns table (photo_id uuid, company_id uuid, visit_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('visitario.purging', 'on', true);

  return query
    update public.photo f set deleted_at = now()
    from public.company c
    where f.company_id = c.id and f.deleted_at is null
      and f.taken_at < now() - make_interval(months => c.photo_retention_months)
    returning f.id, f.company_id, f.visit_id;

  return query
    select f.id, f.company_id, f.visit_id
    from public.photo f
    left join public.visit v on v.id = f.visit_id
    where f.deleted_at < now() - interval '30 days'
       or v.deleted_at < now() - interval '30 days';

  delete from public.photo where deleted_at < now() - interval '30 days';
  delete from public.visit_metric m using public.visit v
    where m.visit_id = v.id and v.deleted_at < now() - interval '30 days';
  delete from public.visit where deleted_at < now() - interval '30 days';
  delete from public.workday w where w.deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.visit v where v.workday_id = w.id);
  delete from public.dni_lookup where searched_at < now() - interval '180 days';

  perform set_config('visitario.purging', '', true);
end $$;

revoke all on function private.purge() from public, anon, authenticated;
grant execute on function private.purge() to service_role;
