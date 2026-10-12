# Visitario — rules for Claude Code

Multi-company SaaS for trade-marketing field work: merchandisers (activadores) visit stores, supervisors assign and review, admins configure the company. Pilot: Panda (distribuidora de Grupo Campari y SKYY).

Read before working: `docs/brief.md` (product), `docs/architecture.md`, `docs/plan.md` (stages and acceptance criteria), `docs/schema.md` (database). Wireframes: https://claude.ai/artifact/UCwQacHtbmL4FmxBaR1uaw (screen codes A, AD, S, SM, D, DM, P are referenced in the plan).

## Language
- **Code is English**: identifiers, tables, columns, enums, functions, file names, commit messages, code comments, error messages raised by the database.
- **UI copy is Spanish (rioplatense)**: everything the person reads in the app. Map database errors to Spanish in the UI (see `src/features/auth/identity-errors.ts`).
- Catalog values and message templates stored as data stay in Spanish.

## Stack
Vite + React 19 + TypeScript strict · TanStack Router (file routes in `src/routes`) and Query · React Hook Form + Zod · Tailwind 4 with design tokens in `src/styles/index.css` · vite-plugin-pwa · Supabase (Postgres + RLS, Auth, Edge Functions) · Cloudflare R2 for photos (stage 1) · Dexie for offline (stage 2).

## Layout
- `src/routes` — route files only: guards (`beforeLoad`) and wiring. No business logic.
- `src/features/<feature>` — screens and hooks per feature (auth, profile, shell, workday...).
- `src/domain` — pure business rules with unit tests. No React, no Supabase.
- `src/ui` — design-system primitives (Button, Field, Card, Banner...). Use tokens, never raw hex.
- `src/lib` — Supabase client, generated types, small utilities.
- `supabase/` — migrations, seed, Edge Functions, DB tests. See `supabase/README.md`.

## Rules
- TypeScript strict, no `any`, no non-null assertions. Files under 300 lines.
- **Style and logic in separate commits.** Conventional commits (`feat:`, `fix:`, `style:`, `refactor:`, `test:`, `docs:`, `chore:`).
- The database is the security boundary. Every new table: `company_id`, forced RLS, policies, column grants, and a test in `supabase/tests/run.mjs` proving another company cannot see it.
- Never put the service role key or any secret in the frontend or the repo. Only `VITE_SUPABASE_URL` and the publishable key are public.
- After any migration: run `npm run test:db`, then regenerate types (`npm run db:types`).
- Mobile first: every screen works at 390 px with one hand (tap targets ≥ 44 px, primary buttons 52 px) and at 1440 px with the sidebar.
- Accessibility: labels on every input, `aria-*` on icon buttons, visible focus.
- Keep solutions simple; no new dependency without a reason in the PR description.

## Commands
```bash
npm run dev          # local app (needs .env.local, copy from .env.example)
npm run lint && npm run typecheck && npm test
npm run test:db      # migrations + RLS checks on PGlite
npm run test:e2e     # Playwright at 390 and 1440 px
npm run build
```

## Definition of done (every stage)
Lint, types and tests green in CI · RLS test per new table · domain rules tested · e2e for the main flow at both viewports · matches wireframes and tokens · tried on a real phone.
