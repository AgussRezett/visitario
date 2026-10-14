-- Daily purge at 03:00 Argentina (06:00 UTC). Applied once to the project (not a test
-- migration: it needs pg_cron and pg_net). The secret is random, made in the database
-- and kept in the Vault; the function checks it with public.purge_authorized.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'purge_secret')
where not exists (select 1 from vault.secrets where name = 'purge_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'visitario-purge',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://mjpzawlyjjlmluozjwap.supabase.co/functions/v1/purge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
