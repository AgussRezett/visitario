-- =============================================================================
-- Realtime: the app listens to changes of the day (visits, their photos and displays,
-- workdays, comments) instead of asking every minute. Supabase Realtime delivers each
-- change only to who can read the row (the same RLS), filtered by company in the app.
-- Guarded: the local test database has no Realtime publication.
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.visit, public.photo, public.display, public.workday, public.comment;
  end if;
end $$;
