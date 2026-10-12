-- =============================================================================
-- Visitario v2 · Maintenance
-- Kept separate: it hard-deletes old soft-deleted rows, so it is applied with the
-- Supabase CLI (or an approved migration), never by an agent tool silently.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Maintenance (scheduled with pg_cron): returns photos past retention so an Edge
-- Function deletes them from R2, and hard-deletes what was soft-deleted 30+ days ago.
-- -----------------------------------------------------------------------------
create function private.purge() returns table (photo_id uuid, company_id uuid, visit_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    update public.photo f set deleted_at = now()
    from public.company c
    where f.company_id = c.id and f.deleted_at is null
      and f.taken_at < now() - make_interval(months => c.photo_retention_months)
    returning f.id, f.company_id, f.visit_id;
  delete from public.visit_metric m using public.visit v
    where m.visit_id = v.id and v.deleted_at < now() - interval '30 days';
  delete from public.visit where deleted_at < now() - interval '30 days';
  delete from public.workday w where w.deleted_at < now() - interval '30 days'
    and not exists (select 1 from public.visit v where v.workday_id = w.id);
  delete from public.dni_lookup where searched_at < now() - interval '180 days';
end $$;

revoke all on function private.purge() from public, anon, authenticated;
grant execute on function private.purge() to service_role;
