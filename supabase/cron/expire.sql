-- Every hour, at minute 17: visits left in progress for 12 hours go back to pending
-- (private.expire_stale_visits, migration 20261023120000). Applied once to the project
-- (not a test migration: it needs pg_cron).
create extension if not exists pg_cron;

select cron.schedule('visitario-expire-visits', '17 * * * *', $$select private.expire_stale_visits()$$);
