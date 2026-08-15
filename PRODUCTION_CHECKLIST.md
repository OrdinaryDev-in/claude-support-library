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

All five closed out. Two need a one-time action from you before they're
fully live (marked below) — everything else is done and verified.

- [x] **Add automated tests.** Vitest (`npm run test`, wired into CI as a
      blocking job) covers `lib/validation/prompt-schema.ts`,
      `lib/auth/require-user.ts`, and `lib/rate-limit.ts` — 34 tests.
      Playwright e2e (`npm run test:e2e`) covers sign up/in, prompt
      create/edit/delete, and the two-account RLS check, against a local
      Supabase stack (`.github/workflows/e2e.yml`, not required-on-PR —
      see that file for why).
- [x] **Add error tracking / observability.** `@sentry/nextjs` is fully
      wired (`instrumentation.ts`, `instrumentation-client.ts`,
      `next.config.ts`) plus `app/error.tsx`, `app/global-error.tsx`,
      `app/not-found.tsx`. **Action needed:** it's inert until you set
      `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` (and `SENTRY_AUTH_TOKEN` for
      source maps) — see `.env.local.example`.
- [x] **Add rate limiting.** Login/signup bypass our server entirely
      (`AuthForm.tsx` calls Supabase's Auth API directly from the
      browser) — Supabase's own dashboard-tunable per-IP limits cover
      those; see the README's new "Rate limiting" section if you want to
      adjust them. What does run on our server is now limited via a
      Postgres-backed counter (`supabase/migrations/0008_rate_limiting.sql`,
      `lib/rate-limit.ts`): `app/(auth)/callback/route.ts` and the
      mutating server actions.
- [x] **Stop leaking raw DB errors to the client.** `lib/errors/action-error.ts`'s
      `toSafeActionError()` now wraps every raw-error return in
      `app/actions/prompts.ts` and `app/actions/profile.ts`.
- [x] **Add security headers / CSP.** `next.config.ts`'s `headers()` now
      sets a real CSP plus `X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`, HSTS, and `Permissions-Policy`. **Note:**
      `script-src`/`style-src` still need `'unsafe-inline'` (Next's inline
      hydration bootstrap, and `app/layout.tsx`'s inline font-variable
      style) — a stronger nonce-based CSP is a follow-up that touches
      `proxy.ts`'s matcher, intentionally out of scope here.

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
- [x] Bump **`@types/node`** from `^20` to `^22` to match the Node 22
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
