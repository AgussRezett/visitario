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
| `20261011190000_maintenance.sql` | applied (by hand) | `private.purge()` (retention + hard delete of soft-deleted rows) |
| `20261011190100_team_policies.sql` | applied (by hand) | Splits the team admin policy (advisor: multiple permissive policies) |
| … | applied | Stages 3–5 (see each file's header) |
| `20261014160000_r2_trash.sql` | applied | `r2_trash` queue, `run_purge()`, `purge_authorized()` |
| `20261017140000_reputation.sql` | applied | `visit.rapport`, `store_reputation()` (numbers only), `rapport_facts()` (under RLS), guard: only the merchandiser rates |
| `20261017160000_store_tidy_and_remove.sql` | applied | `private.tidy_text()` on every store save (+ one-time tidy), archiving removes pending stops from today on, `remove_store()` / `store.removed_at`, `store_open_stops_count()` |
| `20261017180000_supervisor_pending.sql` | applied | `merchandiser_pending`: last 7 days, same rules as `resumable_visits`, never draft days |
| `20261017200000_mvp_backup_merge.sql` | applied (in two parts) | `import_mvp_backup` merges into existing days, reuses known stores, skips addresses the day already has |
| `20261017220000_tidy_leading_digits.sql` | applied | `tidy_text`: only words that start with a digit stay as written |
| `20261017230000_auto_approve.sql` | applied (in two parts) | `membership.auto_approve`, `visit.auto_approved`, `review_auto` trigger; auto-approved visits stay editable for the merchandiser |
| `20261018200000_self_review.sql` | applied | `visit_guard`: a merchandiser who is also supervisor or admin of the company reviews their own visits (a fix still needs the comment) |
| `20261018220000_platform.sql` | applied (in two parts) | Super admin: `platform_companies`, `platform_totals`, `platform_create_company`, `platform_set_plan`, `start_support`, `support_company` (read only, needs an open session) |
| `20261019000000_email_invitations.sql` | applied (in two parts) | `invitation` (DNI + email, token SHA-256, 1 hour), `create/resend/cancel_invitation`, `mark_invitation_sent`, `invitation_preview` (anon), `accept_invitation`, `my_invitations`, `platform_new_company`; `complete_identity` lets an email invitation claim an old placeholder DNI |

Files with `delete`/`drop` statements are refused by the agent connector; apply those with the CLI (`supabase link --project-ref mjpzawlyjjlmluozjwap && supabase db push`) or the SQL Editor.

### Daily purge

`supabase/cron/purge.sql` (applied once, not a migration: it needs pg_cron, pg_net and the Vault) schedules `visitario-purge` at 06:00 UTC (03:00 in Argentina). It calls the `purge` function with a random `purge_secret` that is created in and never leaves the Vault. The function:

1. runs `run_purge()`: `private.purge()` removes what was deleted 30+ days ago and marks photos past the company's retention; their R2 keys go to `r2_trash`;
2. deletes up to 500 queued files from R2; a key leaves the queue only when R2 confirms (404 counts), failures are retried the next day (`attempts`).

Check the runs: `select * from cron.job_run_details order by start_time desc limit 5;` and `select status_code, content from net._http_response order by id desc limit 5;`

## Edge Functions

| Function | Status | What it does |
| --- | --- | --- |
| `sign-in-with-dni` | deployed (v1, `verify_jwt = false`) | Resolves DNI → account email server-side and returns a session. Same 401 for every failure. |
| `photos` | deployed (v1, `verify_jwt = false`, checks the session itself) | `POST /photos` multipart JPEG + meta: inserts the row with the caller's token (RLS + guards), puts the file in R2 at `c/<company>/v/<visit>/<photo>.jpg`, then marks it uploaded. `POST /photos/urls`: 1 h signed links for photos the caller can see. |
| `geocode` | deployed (v1, `verify_jwt = false`, checks the session itself) | LocationIQ search bounded to CABA; says if the street number was found. |
| `route` | deployed (v3, `verify_jwt = false`, checks the session itself) | LocationIQ Matrix + the exact solver (`tsp.ts`, a copy of `src/domain/tsp.ts`) + Directions: the day's order by streets with km and minutes. Without `LOCATIONIQ_KEY` (or on failure) the app keeps its straight-line order. |
| `invitation` | deployed (v1, `verify_jwt = false`, checks the session itself) | Invitations by email: `create` and `resend` (an admin; makes the token, emails the link through Resend, returns the link), `signup` (the link's holder creates the invited email's account, already confirmed). Without `RESEND_API_KEY`/`INVITE_FROM` the invitation is created and the admin shares the link by WhatsApp. |
| `read-capture` | deployed (v1, `verify_jwt = false`, checks the session itself) | Reads a capture of the routing list with Claude (`AI_MODEL`, default `claude-haiku-5-5`) into rows for the import review. Supervisors and admins of pilot/team/internal plans; `AI_MONTHLY_CAPTURES` per company (default 300); usage in `ai_usage`. |
| `purge` | deployed (v1, `verify_jwt = false`, checks the Vault secret) | Daily purge, called by pg_cron (see above). `{ queued, deleted, failed, left }`. |

Deploy: `supabase functions deploy <name> --no-verify-jwt` (the functions call `auth.getUser()`, which works with the new JWT signing keys).

Secrets (Dashboard → Edge Functions → Secrets; never in the repo): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, optional `R2_BUCKET` (default `visitario-photos`), `LOCATIONIQ_KEY`, `ANTHROPIC_API_KEY` (optional `AI_MODEL`, `AI_MONTHLY_CAPTURES`), `RESEND_API_KEY` and `INVITE_FROM` (e.g. `Visitario <invitaciones@tu-dominio.com.ar>`, a domain verified in Resend), optional `APP_URL` (the app's address for the links, default `https://visitario.vercel.app`). Without them `photos`, `purge`, `geocode` and `route` answer 503; the app saves addresses unverified.
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

## MVP backup import

`scripts/import-mvp-backup.mjs ruta/al/visitario-respaldo.json` imports one person's MVP backup as their own
work: it signs in, calls `import_mvp_backup` (platform admins only; the company is the backup's, where the
caller must be an active merchandiser) and uploads the photos through `photos`, without EXIF. Ids are
deterministic, so running it again only uploads what is missing. Needs `.env.local` and the R2 secrets.

It merges into what Visitario already has: a day that already has a workday gets the backup's stops there
(after the ones it had), a store already in the directory is reused (earlier import, customer number or same
address), and an address the day already had is skipped with its photos; the script lists the skipped ones.
Type the password only in the terminal (it is hidden there).
