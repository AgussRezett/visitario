# Supabase — Visitario v2

Project: `visitario` (ref `mjpzawlyjjlmluozjwap`, region `sa-east-1`, Postgres 17).
URL: `https://mjpzawlyjjlmluozjwap.supabase.co`

## Migrations

| File | Status on remote | What it does |
| --- | --- | --- |
| `20261011184336_tables.sql` | applied | Enums, utilities, 24 tables, indexes, touch triggers |
| `20261011184414_permissions_and_guards.sql` | applied | `private` permission helpers and business-rule triggers |
| `20261011184443_row_level_security.sql` | applied | Forced RLS, 55 policies, column grants |
| `20261011184517_rpc_and_views.sql` | applied | 6 RPCs and 3 security-invoker views |
| `20261011190000_maintenance.sql` | **pending** | `private.purge()` (retention + hard delete of soft-deleted rows) |
| `20261011190100_team_policies.sql` | **pending** | Splits the team admin policy (advisor: multiple permissive policies) |

The two pending files contain `delete`/`drop` statements, which the agent connector refuses to run.
Apply them from the repo with the CLI:

```bash
supabase link --project-ref mjpzawlyjjlmluozjwap
supabase db push
```

After that, schedule the purge (Dashboard → Integrations → Cron, or SQL):

```sql
select cron.schedule('visitario-purge', '30 6 * * *', $$select private.purge()$$);
```

The returned photo ids must be deleted from R2 by an Edge Function (stage 1).

## Edge Functions

| Function | Status | What it does |
| --- | --- | --- |
| `sign-in-with-dni` | deployed (v1, `verify_jwt = false`) | Resolves DNI → account email server-side and returns a session. Same 401 for every failure. |

Deploy: `supabase functions deploy sign-in-with-dni --no-verify-jwt`.
Known limit: all DNI sign-ins reach Supabase Auth from the function's IP, so Auth's per-IP rate limit applies to the whole user base. Fine for the pilot; add a per-DNI attempt counter before opening to more companies.

## Seed

`seed/panda.sql` — idempotent. Already applied: Panda (pilot plan), team Norte, 5 brands,
6 display types, 5 work metrics, 4 message templates.

## Tests

```bash
npm i -D @electric-sql/pglite@0.2.17
node supabase/tests/run.mjs   # 44 checks, runs every migration on PGlite with real users per role
```

Move them to pgTAP (`supabase test db`) in stage 0 so CI runs them against real Supabase Postgres.

## Types

`src/lib/database.types.ts` is generated. Regenerate after every migration:

```bash
supabase gen types typescript --project-id mjpzawlyjjlmluozjwap > src/lib/database.types.ts
```

## First admin

Once Agus signs up and completes identity in the app, run (SQL editor):

```sql
insert into public.platform_admin (person_id)
select p.id from public.person p join public.person_private pp on pp.person_id = p.id where pp.dni = '<DNI>';

insert into public.membership (company_id, person_id, roles, team_id, status)
select c.id, pp.person_id, '{admin,merchandiser}', t.id, 'active'
from public.company c join public.team t on t.company_id = c.id and t.name = 'Norte'
cross join public.person_private pp
where c.name = 'Panda' and pp.dni = '<DNI>';
```
