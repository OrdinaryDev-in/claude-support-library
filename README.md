# DevAtlas — a curated, tool-agnostic developer library

[![CI](https://github.com/Mubashir-Mohamed/claude-prompt-library/actions/workflows/ci.yml/badge.svg)](https://github.com/Mubashir-Mohamed/claude-prompt-library/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Mubashir-Mohamed/claude-prompt-library/actions/workflows/codeql.yml/badge.svg)](https://github.com/Mubashir-Mohamed/claude-prompt-library/actions/workflows/codeql.yml)

Two hand-curated, structured library sections for developers — every entry
is written to be copy-pasted and filled in, not just browsed:

- **Prompts** (`/library/prompts`) — elaborate prompt templates for building
  new apps, adding a module/feature, debugging, and frontend- or
  backend-only work. Each carries an explicit "fill in your details"
  section, a place to point at similar reference projects, and
  reference/docs links, plus notes on what a correct AI response should
  include.
- **Skills** (`/library/skills`) — reusable, tool-agnostic agent workflow
  templates (when to reach for it, step-by-step instructions, required
  tools/capabilities, a worked example, and what a correct run looks like).
  Written to be usable as-is by any agent/assistant, not framed around one
  vendor's skill-file format.

Both share the same review workflow, admin-managed category taxonomy, and
authorization model — see "Future phases" at the bottom for the Connectors
section still to come.

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
   (Or run `supabase/migrations/20260815025000_init.sql` then `20260815025500_rls.sql` directly in the
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

Seeds the starter content for each section (both idempotent — safe to
re-run):

```bash
npm run seed          # 48 hand-written prompts across five categories
npm run seed:skills   # 12 hand-written skills across six categories
```

### 5. Promote yourself to admin (optional)

Admins can edit/delete any prompt or skill (not just their own), manage the
category taxonomy (the inline "+ New category" control on each resource's
create/edit form), and approve/reject submissions at `/admin/review` and
`/admin/review/skills` — every new prompt/skill starts `pending_review` and
only appears in the public library once an admin approves it (see "Review
workflow" below). There's no self-serve promotion UI — after signing up
once, run this in the Supabase SQL editor:

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
                     # app/actions/{prompts,skills,profile,categories}.ts

# E2E (Playwright) — needs a local Supabase stack:
supabase start && supabase db reset
npm run test:e2e    # e2e/core-flows.spec.ts (Prompts) + e2e/skills-flow.spec.ts
```

No manual env var wrangling needed for `test:e2e` — the script (`package.json`)
runs `scripts/write-e2e-env.sh` first (regenerates `.env.test.local` straight
from the running local stack) and then runs Playwright itself under
`NODE_ENV=test`, so Next.js skips your real `.env.local` entirely (see
[Next's docs](https://nextjs.org/docs/app/guides/environment-variables#test-environment-variables))
both when `playwright.config.ts` loads those values for its own use and
when `webServer` rebuilds the app. Relying on the invoking shell's own
exported env vars here used to be the approach and turned out to be
unreliable in practice across a couple of rounds of debugging — this
sidesteps it completely.

`test/integration/role-escalation.test.ts` (part of `npm run test`) is a
real-database test of the `prevent_role_self_escalation` trigger — it
only runs against a `127.0.0.1`/`localhost` Supabase URL, so it's a no-op
against your normal dev `.env.local`.

## Project structure

```
app/(auth)/{login,signup,callback}   — sign in/up, OAuth (currently hidden) + email-confirm callback
app/{privacy,terms}                  — legal pages (draft placeholder content — replace before relying on it)
app/(app)/layout.tsx                 — authenticated shell (NavBar + gating backstop)
app/(app)/library                    — hub, browse/filter, detail, create/edit (prompts + skills)
app/(app)/admin/review               — review queues (prompts + skills)
app/(app)/account                    — profile + password reset
app/actions/{prompts,skills,profile,categories}.ts — server actions (the real CRUD authorization boundary, alongside RLS)
app/actions/{review,skill-review}.ts — approve/reject actions per resource type
components/library/                  — shared Library* components (LibraryList, LibraryFilters, LibraryCard, StatusPill, count-context factory) both resource types build on
proxy.ts                             — session refresh, auth redirect, per-request CSP nonce (Next 16's renamed middleware.ts)
lib/security/csp.ts                  — Content-Security-Policy builder used by proxy.ts
next.config.ts                       — static security headers (HSTS, X-Frame-Options, etc.)
supabase/migrations/                 — schema + RLS
supabase/config.toml                 — local Supabase stack config (`supabase start`)
scripts/seed-data.ts, seed-prompts.ts       — the 48 starter prompts + loader (npm run seed)
scripts/seed-skills-data.ts, seed-skills.ts — the 12 starter skills + loader (npm run seed:skills)
app/actions/*.test.ts, test/         — Vitest unit + integration tests
e2e/                                 — Playwright E2E tests
.github/workflows/backup.yml         — scheduled Supabase dump (Free-tier backup workaround)
```

## Review workflow

New submissions never go straight to the public library, for either
resource type. A prompt or skill starts `pending_review` on creation, is
invisible to everyone but its author and admins (RLS:
`prompts_select_signed_in` / `skills_select_signed_in`), and only becomes
visible once an admin approves it at `/admin/review` (prompts) or
`/admin/review/skills` — reject instead and the author sees the reason on
their own submission (and their "My Submissions" list on `/account`, for
prompts). Editing an already-approved or -rejected row's content
automatically resubmits it for review, and so does changing its tags. See
`supabase/migrations/20260816090111_prompt_review_workflow.sql` /
`20260824140000_skills.sql` for the schema/RLS and
`app/actions/review.ts` / `app/actions/skill-review.ts` for the
approve/reject actions.

### Categories

Categories are a shared, admin-managed table (`supabase/migrations/20260824130000_categories.sql`),
not a fixed enum — any signed-in user can add a new **tag** freely (typed
directly into a prompt/skill's tags field), but a new **category** requires
an admin, added inline via the "+ New category" control on the
create/edit form rather than a separate admin page. See
`lib/data/categories.ts` and `app/actions/categories.ts`.

## Verifying it works

- Sign up, sign in, sign out; confirm `/library` redirects to `/login` when signed out.
- Create a prompt, view its detail page (shows a "Pending Review" pill to
  you as the author), use **Copy prompt**. Repeat for a skill at
  `/library/skills/new` (**Copy skill**).
- Promote yourself to admin via the SQL above, approve the prompt at
  `/admin/review` (and the skill at `/admin/review/skills`), and confirm
  each now shows up in its public grid with no pill.
- As an admin, use the inline "+ New category" control on a prompt or
  skill's create/edit form and confirm the new category is immediately
  selectable and shows up in that section's filter legend.
- Sign in as a second account and confirm you can't see a still-pending
  prompt/skill at all (404, not just hidden UI), and can't edit an approved
  one you don't own (RLS-enforced, redirected server-side) — then promote
  that second account to admin via the SQL above and confirm it now can.
- Filter by category and tag on `/library/prompts` and `/library/skills`,
  and try the `/` keyboard shortcut to jump to search.
- `npm run test:e2e` covers both flows end-to-end against a local Supabase
  stack (`supabase start` first) — see `e2e/core-flows.spec.ts` and
  `e2e/skills-flow.spec.ts`.

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
`supabase/migrations/20260815025500_rls.sql`. One thing worth calling out from a
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

**Skills** shipped as the second resource type, proving out the pattern:
a `skills` table on the same shared column convention as Prompts (own
migration, `supabase/migrations/20260824140000_skills.sql`), the
`/library/skills` route built on the now-genuinely-generic
`LibraryList` / `LibraryFilters` / `LibraryCard` components, and the
`skills` entry in `lib/constants/library-sections.ts` flipped to
`enabled: true`. Nothing in `profiles`, auth, or the shared components
needed to change.

**Connectors** (Volume III) is next, same pattern — a curated set of
guides for wiring an AI coding agent to external tools/data sources (MCP
server setup, API-key/auth patterns for tool use), not cloud
infrastructure docs and not Claude's own "Connectors" feature. Deliberately
scoped small and hand-curated rather than an exhaustive directory — large
public registries for this already exist (mcp.so, the official
`registry.modelcontextprotocol.io`, glama.ai); DevAtlas's value is the same
curated, structured, reviewed format Prompts and Skills already prove out,
not catalog coverage.
