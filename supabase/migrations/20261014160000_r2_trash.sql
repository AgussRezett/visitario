-- =============================================================================
-- Daily purge, second half: the photo files that must leave R2 wait in r2_trash
-- until the "purge" Edge Function deletes them, so a failed delete is retried the
-- next day instead of leaving the file behind. Only the service role touches it.
-- (The schedule itself lives in supabase/cron/purge.sql: it needs pg_cron and pg_net.)
-- =============================================================================
create table public.r2_trash (
  key         text primary key check (key ~ '^c/[0-9a-f-]{36}/v/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  created_at  timestamptz not null default now(),
  attempts    integer not null default 0
);
alter table public.r2_trash enable row level security; -- no policies: the app never sees it
revoke all on public.r2_trash from anon, authenticated;

-- Runs the purge and queues the files of every photo it returned. Returns how many were queued.
create function public.run_purge() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  insert into public.r2_trash (key)
  select 'c/' || p.company_id || '/v/' || p.visit_id || '/' || p.photo_id || '.jpg'
  from private.purge() p
  on conflict (key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.run_purge() from public, anon, authenticated;
grant execute on function public.run_purge() to service_role;

-- The daily call (supabase/cron/purge.sql) sends the 'purge_secret' kept in the Vault;
-- the purge function checks it here, so the secret only lives in the database.
create function public.purge_authorized(p_secret text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return coalesce(p_secret, '') <> '' and exists (
    select 1 from vault.decrypted_secrets where name = 'purge_secret' and decrypted_secret = p_secret);
end $$;

revoke all on function public.purge_authorized(text) from public, anon, authenticated;
grant execute on function public.purge_authorized(text) to service_role;
