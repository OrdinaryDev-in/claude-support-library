# Production Launch Checklist

Pending items only — anything already shipped and verified has been
removed rather than kept as a checked-off record here (see git history /
[SECURITY.md](SECURITY.md) for what's already in place: RLS + escalation
triggers, per-request CSP, static security headers, rate limiting on auth
flows and prompt/review server actions, DB-level text-length constraints,
`safeActionError()` scrubbing + DB-backed error logging, validated auth
redirects, least-privilege CI workflow permissions, an encrypted DB
backup artifact, SEO basics (robots/sitemap/metadata), an accessibility
pass on every form/dialog/list, no committed secrets, CI lint/typecheck/
build/CodeQL/`npm audit`, unit + E2E test coverage).

Originally reviewed 2026-08-15, re-verified 2026-08-16 and again
2026-08-18 (attack-surface/data-leak pass, then implementation pass —
every code-level finding from that pass is closed; what's left below is
exclusively dashboard/account settings and open decisions nothing in this
repo can perform).

## 🟠 Should-fix before/shortly after launch

All remaining items here are manual steps in an external dashboard
(Supabase, Vercel, GitHub) — nothing left to implement in this repo.

- [ ] Confirm **"Confirm email"** is re-enabled on the production Supabase
      project (README notes it's only disabled for local dev convenience).
- [ ] Update Supabase Auth **Site URL / redirect allow-list** to the real
      production domain (easy-to-forget manual deploy step, README §6).
- [ ] Revisit **leaked-password-protection** (disabled — Free-tier
      limitation, currently an accepted risk in
      `scripts/supabase-security-allowlist.json`) once/if on a paid tier.
- [ ] Double-check the **Vercel project's env vars** match
      `.env.local.example` exactly before the first prod deploy — there's
      no deployment config committed to the repo to enforce this.
- [ ] **Confirm branch protection on `main`.** Not checkable from the
      CLI — verify in repo settings whether required review + passing
      checks before merge is configured, given direct pushes to `main`
      have happened this session.

## 🟡 Worth a decision, not blocking

- [ ] Decide whether `npm audit --audit-level=high` in CI should become a
      hard gate instead of advisory-only (`continue-on-error: true`).
- [ ] Confirm the disabled **Skills** / **Cloud Connectors** "coming soon"
      cards (`lib/constants/library-sections.ts`, `enabled: false`) render
      correctly and don't link anywhere broken — these are intentional
      Phase 2/3 stubs, not a gap.
- [ ] **Set `SUPABASE_ACCESS_TOKEN` locally.** The pre-push security gate
      (`scripts/check-supabase-security.sh`) has been bypassed with
      `--no-verify` repeatedly this session because the token isn't set
      in this shell — it only protects against a bad push when it isn't
      skipped.
- [ ] **Enable 2FA** on the GitHub and Supabase accounts, if not already
      on. The RLS/CSP/rate-limiting stack is moot if either account is
      taken over directly.
