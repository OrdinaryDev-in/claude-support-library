# DevAtlas — Phase 1: Prompt Library

[![CI](https://github.com/Mubashir-Mohamed/claude-prompt-library/actions/workflows/ci.yml/badge.svg)](https://github.com/Mubashir-Mohamed/claude-prompt-library/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Mubashir-Mohamed/claude-prompt-library/actions/workflows/codeql.yml/badge.svg)](https://github.com/Mubashir-Mohamed/claude-prompt-library/actions/workflows/codeql.yml)

A library of elaborate, structured AI-coding prompt templates for developers
— for building new apps, adding a module/feature, debugging, and frontend-
or backend-only work. Every prompt is written to be copy-pasted and filled
in: it carries an explicit "fill in your details" section, a place to point
at similar reference projects, and reference/docs links, plus notes on what
a correct AI response should include.

This is Phase 1 of a larger platform. The data model, routes (`/library/...`)
and shared `Library*` components are built so a **Skills library** and a
**Cloud Connectors library** can be added later as new, additive modules —
see the "Future phases" note at the bottom of this file.

## Stack

Next.js 16 (App Router, TypeScript, Server Components + Server Actions) ·
Supabase (Postgres + Auth + Row Level Security) · Tailwind CSS v4.

Requires **Node 22+** (see `.nvmrc`/`package.json`'s `engines`) — matches
what CI runs; `@supabase/supabase-js` warns and will eventually drop
support for older versions.

## Setup

### 1. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Install the Supabase CLI and link it: `supabase login && supabase link --project-ref <your-project-ref>`.
3. Apply the schema and RLS policies:
   ```bash
   supabase db push
   ```
   (Or run `supabase/migrations/0001_init.sql` then `0002_rls.sql` directly in the
   SQL editor if you're not using the CLI.)
4. In **Authentication → Providers**, enable **Google** and **GitHub** OAuth
   (or skip this and use email/password only — both are wired up).
5. In **Authentication → URL Configuration**, set the **Site URL** to your
   deployed domain (or `http://localhost:3000` for local dev) and add
   `http://localhost:3000/callback` to **Additional Redirect URLs**.
6. Local dev tip: if you don't want to click an email confirmation link on
   every test signup, disable "Confirm email" under **Authentication →
   Providers → Email** for local/dev use only.

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from
**Project Settings → API**. `SUPABASE_SERVICE_ROLE_KEY` (also from that
page) is only needed to run the seed script below — it's never used by the
running app and must never be committed or exposed to the browser.

### 3. Install and run

```bash
npm install
npm run dev
```

### 4. Load the starter library

Seeds 48 hand-written prompts across all five categories (idempotent —
safe to re-run):

```bash
npm run seed
```

### 5. Promote yourself to admin (optional)

Admins can edit/delete any prompt, not just their own. There's no self-serve
promotion UI in Phase 1 — after signing up once, run this in the Supabase
SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

### 6. Deploy

Connect the repo to Vercel, set the same three env vars in the Vercel
project settings (`SUPABASE_SERVICE_ROLE_KEY` isn't needed there unless
you'll run the seed script against prod from CI), and update the Supabase
**Site URL**/redirect allow-list to your production domain.

Before real users sign up: configure **custom SMTP** in the Supabase
dashboard (Authentication → Emails) — the built-in mailer's rate limit
will otherwise block signups almost immediately — and add a
`SUPABASE_ACCESS_TOKEN` GitHub Actions secret (Dashboard → Account →
Access Tokens) so the CI security gate and backup workflow
(`.github/workflows/{ci,backup}.yml`) can run. Google/GitHub OAuth
buttons are currently hidden (`OAUTH_ENABLED` in
`components/auth/AuthForm.tsx`) until those providers are configured with
production callback URLs.

## Testing

```bash
npm run test        # unit tests (Vitest) — the authorization boundary:
                     # app/actions/{prompts,profile}.ts

# E2E (Playwright) — needs a local Supabase stack:
supabase start && supabase db reset

# Loads the env vars via `source`, not `export $(...)` — `source` is what
# actually parses supabase status's shell-quoted KEY="value" output as
# assignment syntax; capturing it another way (e.g. `export $(cat ...)`,
# a naive `cut`) tends to leave the quote characters embedded literally
# in the value, which crashes proxy.ts's CSP builder on every request
# with `TypeError: Invalid URL`.
set -a
source <(supabase status -o env \
  --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
  --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY)
set +a

npm run test:e2e
```

`test/integration/role-escalation.test.ts` (part of `npm run test`) is a
real-database test of the `prevent_role_self_escalation` trigger — it
only runs against a `127.0.0.1`/`localhost` Supabase URL, so it's a no-op
against your normal dev `.env.local`.

## Project structure

```
app/(auth)/{login,signup,callback}   — sign in/up, OAuth (currently hidden) + email-confirm callback
app/{privacy,terms}                  — legal pages (draft placeholder content — replace before relying on it)
app/(app)/layout.tsx                 — authenticated shell (NavBar + gating backstop)
app/(app)/library                    — hub, browse/filter, detail, create/edit
app/(app)/account                    — profile + password reset
app/actions/{prompts,profile}.ts     — server actions (the real CRUD authorization boundary, alongside RLS)
proxy.ts                             — session refresh, auth redirect, per-request CSP nonce (Next 16's renamed middleware.ts)
lib/security/csp.ts                  — Content-Security-Policy builder used by proxy.ts
next.config.ts                       — static security headers (HSTS, X-Frame-Options, etc.)
supabase/migrations/                 — schema + RLS
supabase/config.toml                 — local Supabase stack config (`supabase start`)
scripts/seed-data.ts                 — the 48 starter prompts (source of truth)
scripts/seed-prompts.ts              — loads them via Supabase (npm run seed)
app/actions/*.test.ts, test/         — Vitest unit + integration tests
e2e/                                 — Playwright E2E tests
.github/workflows/backup.yml         — scheduled Supabase dump (Free-tier backup workaround)
```

## Verifying it works

- Sign up, sign in, sign out; confirm `/library` redirects to `/login` when signed out.
- Create a prompt, view its detail page, use **Copy prompt**.
- Sign in as a second account and confirm you can't edit/delete the first account's prompt (RLS-enforced, not just hidden in the UI) — then promote that second account to admin via the SQL above and confirm it now can.
- Filter by category and tag on `/library/prompts`, and try the `/` keyboard shortcut to jump to search.

## CI & security

Two GitHub Actions workflows run on every push/PR to `main`
(`.github/workflows/`):

- **`ci.yml`** — installs deps, `npm run lint`, `tsc --noEmit`, `next build`,
  and an `npm audit` pass for known-vulnerable dependencies (advisory only —
  it reports rather than blocks, since transitive advisories are outside
  this repo's control).
- **`codeql.yml`** — GitHub CodeQL static analysis for the JS/TypeScript
  code, also on a weekly schedule so new advisory patterns get caught
  between pushes.

This app's authorization model leans on Postgres Row Level Security, not
just app-layer checks — every table's policies live in
`supabase/migrations/0002_rls.sql`. One thing worth calling out from a
security review of that file: `profiles_update_own`'s `USING (auth.uid() =
id)` clause, on its own, only restricts *which row* a user can update, not
*which columns* — without the accompanying
`prevent_role_self_escalation` trigger in the same migration, any signed-in
user could set their own `role` to `'admin'` via a direct PostgREST call,
bypassing the app UI entirely. That trigger (not just the RLS policy) is
what actually blocks it, since a policy's implicit `WITH CHECK` can't
compare old vs. new column values the way a `BEFORE UPDATE` trigger can.

### Pre-push security gate

`npm install` wires up a **husky `pre-push` hook**
(`.husky/pre-push` → `scripts/check-supabase-security.sh`) that runs
`supabase db advisors --linked --type security --level warn` against the
live linked project — the same check that powers the dashboard's Advisors
tab and the MCP `get_advisors` tool — and pipes the JSON output through
`scripts/filter-supabase-advisors.mjs`. Any security advisory at `warn`
level or above (RLS gaps, `SECURITY DEFINER` functions callable by `anon`,
missing `to authenticated` clauses, etc.) blocks the push, **except**
findings explicitly listed in `scripts/supabase-security-allowlist.json`
(currently one: `is_admin`'s `authenticated` EXECUTE grant, which RLS
policies require — every allowlist entry must carry a `reason`). It **fails
closed**: if the check can't run at all (CLI missing, no access token,
unparseable output), the push is blocked too, not silently allowed.

One-time setup per machine:

```bash
# https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_...   # add to your shell profile
```

Run it manually any time with `npm run supabase:security-check`. Deliberate
bypass (e.g. a known false positive not yet allowlisted):
`git push --no-verify`.

## Future phases

Skills and Cloud Connectors libraries are not built yet. Adding **Skills**
as the next resource type is additive: a new migration for a `skills`
table (same shared column convention + its own structured fields), a new
`/library/skills` route reusing the existing generic `LibraryList` /
`LibraryFilters` / `LibraryCard` components, and one new entry in
`lib/constants/library-sections.ts` to light up its hub card and nav link.
Nothing in `profiles`, auth, or the shared components needs to change.
