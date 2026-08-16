# Production Launch Checklist

Status snapshot of what's outstanding before DevAtlas (Phase 1: Prompt
Library) goes live. Originally reviewed 2026-08-15; re-verified against
the codebase on 2026-08-16 after the prompt review workflow landed —
several items below moved out of "blocking" since that review, checked
directly rather than assumed. Grouped by priority, with the relevant
file/config location for each item.

## ✅ Already solid

No action needed here — called out so these aren't re-litigated later.

- Supabase Auth (email/password + Google/GitHub OAuth) with two-layer
  authorization: server-action checks (`app/actions/prompts.ts`,
  `app/actions/profile.ts`, `app/actions/review.ts`) *and* Postgres RLS,
  including a `prevent_role_self_escalation` trigger and a
  `guard_prompt_review_state` trigger that each close a real
  privilege-escalation path.
- Fifteen migrations (`supabase/migrations/0001`–`0015`) showing genuine
  iterative security-review passes, not just an initial schema dump —
  including the prompt review workflow's own RLS/trigger hardening pass
  and a caught-and-fixed RLS-disabled incident on `profiles` (0015).
- A pre-push husky gate (`.husky/pre-push` → `scripts/check-supabase-security.sh`)
  that fails closed on any unresolved live Supabase security advisory —
  this is what caught the 0015 incident above before it reached `main`.
- No secrets committed; env var handling follows best practice
  (`.env.local.example`, `.gitignore`).
- Zod validation on both client and server for prompt create/edit
  (`lib/validation/prompt-schema.ts`).
- CI: lint, typecheck (`next typegen` + `tsc --noEmit`), build, CodeQL
  (weekly + on-push), `npm audit` (`.github/workflows/`).
- **Automated tests**: unit tests for every server action
  (`app/actions/*.test.ts`) and security helper (`lib/security/*.test.ts`),
  plus an E2E suite (`e2e/core-flows.spec.ts`) covering signup/login,
  RLS-enforced authorization, and the full prompt review workflow
  (submit → invisible while pending → admin approves/rejects → author
  sees the result) against a real local Supabase stack.
- **Security headers + CSP**: `next.config.ts` sets HSTS,
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and
  `Permissions-Policy`; `proxy.ts` sets a nonce-based CSP per request
  (`Content-Security-Policy-Report-Only` until `CSP_ENFORCE=true`, see
  `lib/security/csp.ts`).
- **No raw DB errors reaching the client**: every server action
  (`app/actions/{prompts,profile,review}.ts`) routes failures through
  `safeActionError()` (`lib/errors.ts`) — logs server-side, returns a
  generic message.
- `@types/node` is already `^22`, matching CI's Node 22 runtime.

## 🔴 Blocking — fix before launch

Both items originally here are resolved as of 2026-08-16:

- [x] ~~Add rate limiting on auth endpoints.~~ `checkAuthRateLimit()`
      (`app/actions/auth.ts`) gives `/login` and `/signup` the same
      IP-based throttle `app/(auth)/callback/route.ts` already had — a
      Server Action `AuthForm.tsx` calls as a pre-flight check before the
      actual credential submission (which still has to run client-side;
      `signUp()`'s `emailRedirectTo` needs `window.location.origin`).
      `getClientIp` generalized to take any headers-shaped object so it
      works from both a Route Handler and a Server Action.
- [x] ~~Add App Router error boundaries.~~ `app/not-found.tsx`,
      `app/error.tsx`, `app/global-error.tsx` all added — styled
      consistently with the rest of the app, verified in-browser. Each
      `console.error`s the caught error with a comment marking exactly
      where `Sentry.captureException(error)` would go.
- [ ] **Add real error tracking (Sentry or equivalent).** Explicitly
      deferred 2026-08-16 — skipping a third-party service for now. The
      error boundaries above mean errors at least reach Vercel's own
      function/runtime logs instead of vanishing silently, but there's
      still no structured tracking, alerting, or aggregation. Revisit once
      there's real traffic to actually justify it.

## 🟠 Should-fix before/shortly after launch

- [ ] Confirm **"Confirm email"** is re-enabled on the production Supabase
      project (README notes it's only disabled for local dev convenience).
- [ ] Update Supabase Auth **Site URL / redirect allow-list** to the real
      production domain (easy-to-forget manual deploy step, README §6).
- [ ] Revisit **leaked-password-protection** (disabled — Free-tier
      limitation, currently an accepted risk in
      `scripts/supabase-security-allowlist.json`) once/if on a paid tier.
- [x] ~~Decide if the manual-SQL admin promotion flow is acceptable for
      launch, or needs a self-serve UI.~~ Decided 2026-08-16: fine for
      launch as a solo-admin project; revisit once a second admin is
      needed regularly enough that manual SQL becomes real friction.
- [ ] Add **SEO basics**: `robots.txt`, `app/sitemap.ts`, Open Graph/Twitter
      metadata, and per-route `<title>`/`description` overrides (currently
      only set on the root `app/layout.tsx`). Applies to the new
      `/admin/review` routes too, though those are non-public and lower
      priority than the public-facing pages.
- [ ] Pass on **accessibility**: `AuthForm`, `ProfileForm`, `PromptForm`,
      `PromptDetail`, `CopyButton`, `LibraryCard`/`LibraryHub`,
      and the new `ReviewQueueTable`/`ReviewDetail`/`StatusPill`/
      `MySubmissions` all rely on native semantic HTML with no explicit
      ARIA.
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
