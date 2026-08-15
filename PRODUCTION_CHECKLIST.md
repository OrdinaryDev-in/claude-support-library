# Production Launch Checklist

Status snapshot of what's outstanding before DevAtlas (Phase 1: Prompt
Library) goes live, based on a review of the codebase as of 2026-08-15.
Grouped by priority, with the relevant file/config location for each item.

## ✅ Already solid

No action needed here — called out so these aren't re-litigated later.

- Supabase Auth (email/password + Google/GitHub OAuth) with two-layer
  authorization: server-action checks (`app/actions/prompts.ts`,
  `app/actions/profile.ts`) *and* Postgres RLS, including a dedicated
  `prevent_role_self_escalation` trigger that closes a real
  privilege-escalation path.
- Seven migrations (`supabase/migrations/0001`–`0007`) showing genuine
  iterative security-review passes, not just an initial schema dump.
- A pre-push husky gate (`.husky/pre-push` → `scripts/check-supabase-security.sh`)
  that fails closed on any unresolved live Supabase security advisory.
- No secrets committed; env var handling follows best practice
  (`.env.local.example`, `.gitignore`).
- Zod validation on both client and server for prompt create/edit
  (`lib/validation/prompt-schema.ts`).
- CI: lint, typecheck (`next typegen` + `tsc --noEmit`), build, CodeQL
  (weekly + on-push), `npm audit` (`.github/workflows/`).

## 🔴 Blocking — fix before launch

- [ ] **Add automated tests.** Zero unit/integration/e2e coverage exists —
      no test framework in `package.json`. At minimum, cover the
      RLS-dependent auth flows and the server actions in
      `app/actions/prompts.ts` / `app/actions/profile.ts`.
- [ ] **Add error tracking / observability.** No Sentry (or equivalent), no
      structured logging, no App Router error boundaries anywhere under
      `app/` (`error.tsx`, `global-error.tsx`, `not-found.tsx` are all
      absent). Production errors currently have zero visibility once
      deployed.
- [ ] **Add rate limiting on auth endpoints.** `/login`, `/signup`, and
      `app/(auth)/callback/route.ts` have no throttling — open to
      brute-force / credential-stuffing.
- [ ] **Stop leaking raw DB errors to the client.** `createPrompt`,
      `updatePrompt`, `deletePrompt` (`app/actions/prompts.ts`) and
      `updatePassword` (`app/actions/profile.ts`) surface `error.message`
      from Supabase/Postgres directly to the UI. Replace with generic
      user-facing messages and log the real error server-side once
      observability is in place.
- [ ] **Add security headers / CSP.** `next.config.ts` is the bare
      default — no CSP, `X-Frame-Options`, HSTS, or `Referrer-Policy`.

## 🟠 Should-fix before/shortly after launch

- [ ] Confirm **"Confirm email"** is re-enabled on the production Supabase
      project (README notes it's only disabled for local dev convenience).
- [ ] Update Supabase Auth **Site URL / redirect allow-list** to the real
      production domain (easy-to-forget manual deploy step, README §6).
- [ ] Revisit **leaked-password-protection** (disabled — Free-tier
      limitation, currently an accepted risk in
      `scripts/supabase-security-allowlist.json`) once/if on a paid tier.
- [ ] Decide if the **manual-SQL admin promotion** flow (README §5) is
      acceptable for launch, or needs a self-serve UI.
- [ ] Bump **`@types/node`** from `^20` to `^22` to match the Node 22
      runtime used in CI (`.github/workflows/ci.yml`).
- [ ] Add **SEO basics**: `robots.txt`, `app/sitemap.ts`, Open Graph/Twitter
      metadata, and per-route `<title>`/`description` overrides (currently
      only set on the root `app/layout.tsx`).
- [ ] Pass on **accessibility**: `AuthForm`, `ProfileForm`, `PromptForm`,
      `PromptDetail`, `CopyButton`, `LibraryCard`/`LibraryHub` rely on
      native semantic HTML with no explicit ARIA.
- [ ] Double-check the **Vercel project's env vars** match
      `.env.local.example` exactly before the first prod deploy — there's
      no deployment config committed to the repo to enforce this.

## 🟡 Worth a decision, not blocking

- [ ] Decide whether `npm audit --audit-level=high` in CI should become a
      hard gate instead of advisory-only (`continue-on-error: true`).
- [ ] Confirm the disabled **Skills** / **Cloud Connectors** "coming soon"
      cards (`lib/constants/library-sections.ts`, `enabled: false`) render
      correctly and don't link anywhere broken — these are intentional
      Phase 2/3 stubs, not a gap.
