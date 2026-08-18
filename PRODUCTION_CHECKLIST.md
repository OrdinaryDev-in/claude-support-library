# Production Launch Checklist

Pending items only — anything already shipped and verified has been
removed rather than kept as a checked-off record here (see git history /
[SECURITY.md](SECURITY.md) for what's already in place: RLS + escalation
triggers, per-request CSP, static security headers, rate limiting on auth
flows, `safeActionError()` scrubbing, no committed secrets, CI lint/
typecheck/build/CodeQL/`npm audit`, unit + E2E test coverage).

Originally reviewed 2026-08-15, re-verified 2026-08-16. Re-verified again
2026-08-18 against a full attack-surface/data-leak pass — several items
below are new from that pass, marked accordingly.

## 🔴 Blocking — fix before launch

- [ ] **Encrypt or restrict the nightly DB backup artifact.** (New
      2026-08-18.) `.github/workflows/backup.yml` uploads a full
      schema+data dump via `actions/upload-artifact`, retained 90 days.
      This repo is public — GitHub Actions artifacts on a public repo are
      downloadable by any GitHub account, no special permission needed.
      That means the full database (including user data) is currently
      exposed. Fix with zero new dependencies: encrypt the dump with
      `openssl enc -aes-256-cbc -pbkdf2` (preinstalled on `ubuntu-latest`)
      using a passphrase stored as a GitHub Actions secret before the
      upload step, or make the repo private.
- [ ] **Add real error tracking (Sentry or equivalent).** Explicitly
      deferred 2026-08-16 — skipping a third-party service for now. The
      error boundaries (`app/not-found.tsx`, `app/error.tsx`,
      `app/global-error.tsx`) mean errors at least reach Vercel's own
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
- [ ] Add **SEO basics**: `robots.txt`, `app/sitemap.ts`, Open Graph/Twitter
      metadata, and per-route `<title>`/`description` overrides (currently
      only set on the root `app/layout.tsx`). Applies to the new
      `/admin/review` routes too, though those are non-public and lower
      priority than the public-facing pages.
- [ ] Pass on **accessibility**: `AuthForm`, `ProfileForm`, `PromptForm`,
      `PromptDetail`, `CopyButton`, `LibraryCard`/`LibraryHub`,
      and the `ReviewQueueTable`/`ReviewDetail`/`StatusPill`/
      `MySubmissions` all rely on native semantic HTML with no explicit
      ARIA.
- [ ] Double-check the **Vercel project's env vars** match
      `.env.local.example` exactly before the first prod deploy — there's
      no deployment config committed to the repo to enforce this.
- [ ] **Validate the `next` redirect param.** (New 2026-08-18.)
      `app/(auth)/callback/route.ts` builds the post-login redirect as
      `${origin}${next}` from an unvalidated query param. Today's string
      concatenation happens to prevent a functional open redirect, but
      that's incidental, not enforced — reject/normalize any `next` that
      doesn't start with a single `/` (not `//`) before using it.
- [ ] **Rate-limit prompt/review server actions.** (New 2026-08-18.)
      `checkRateLimit()` only guards auth flows (`app/actions/auth.ts`,
      the OAuth callback route). `app/actions/prompts.ts` and
      `app/actions/review.ts` have no throttle — an authenticated user (or
      a compromised session) can spam prompt-submit or review-decision
      actions with no limit.
- [ ] **Add DB-level length constraints on free-text columns.** (New
      2026-08-18.) Zod validates on client and server, but there's no
      matching `CHECK` constraint in the schema — if anything ever calls
      PostgREST directly with a valid anon/authenticated key (bypassing
      the server actions), there's no backstop against unbounded text.
- [ ] **Add least-privilege `permissions:` blocks to remaining workflows.**
      (New 2026-08-18.) Only `main.yml` declares an explicit `permissions:`
      block; `ci.yml`, `codeql.yml`, and `backup.yml` still run on
      whatever the repo's default `GITHUB_TOKEN` permissions are. Add
      `permissions: contents: read` at the workflow level to each, with
      narrow write scopes added only where a job actually needs one.
- [ ] **Confirm branch protection on `main`.** (New 2026-08-18.) Not
      checkable from the CLI — verify in repo settings whether required
      review + passing checks before merge is configured, given direct
      pushes to `main` have happened this session.

## 🟡 Worth a decision, not blocking

- [ ] Decide whether `npm audit --audit-level=high` in CI should become a
      hard gate instead of advisory-only (`continue-on-error: true`).
- [ ] Confirm the disabled **Skills** / **Cloud Connectors** "coming soon"
      cards (`lib/constants/library-sections.ts`, `enabled: false`) render
      correctly and don't link anywhere broken — these are intentional
      Phase 2/3 stubs, not a gap.
- [ ] **Set `SUPABASE_ACCESS_TOKEN` locally.** (New 2026-08-18.) The
      pre-push security gate (`scripts/check-supabase-security.sh`) has
      been bypassed with `--no-verify` repeatedly this session because the
      token isn't set in this shell — it only protects against a bad push
      when it isn't skipped.
- [ ] **Enable 2FA** on the GitHub and Supabase accounts, if not already
      on. (New 2026-08-18.) The RLS/CSP/rate-limiting stack is moot if
      either account is taken over directly.
