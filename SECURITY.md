# Security Policy

## Supported Versions

This project ships continuously from `main` — there are no maintained
release branches or versioned tags. Security fixes are made against
`main` only; if you're running a fork or an older checkout, update to the
latest `main` before reporting an issue you haven't reproduced there.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for a security vulnerability.**
This app's authorization model leans on Postgres Row Level Security (see
[README.md](README.md#ci--security)) as well as app-layer checks, so a
report about auth, RLS, session handling, or data exposure could point
directly at exploitable data access — filing it publicly gives that away
before it's fixed.

Instead, email **mubashir585@gmail.com** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce (or a proof of concept)
- Any relevant logs, requests, or affected file/route

You should get an acknowledgment within a few days. From there:

- We'll work with you to confirm the issue and assess severity
- We'll aim to ship a fix before any public disclosure
- We'll credit you in the fix (commit message / release notes) if you'd
  like — just say so in your report

## Scope

In scope:

- Authentication and session handling (`proxy.ts`,
  `lib/supabase/middleware.ts`, `app/(auth)/`)
- Row Level Security policies and database functions
  (`supabase/migrations/`)
- Server Actions that mutate data (`app/actions/`)
- Privilege escalation (e.g. a non-admin user gaining admin-only access)
- Content-Security-Policy / security headers (`lib/security/csp.ts`,
  `next.config.ts`)

Out of scope:

- Vulnerabilities in third-party dependencies with no demonstrated impact
  on this app specifically — please report those upstream (or via
  `npm audit`, which CI already runs) rather than here
- Findings that only apply to a local dev environment using the
  placeholder/example env values

## How we catch issues before you have to

For context: this repo also runs an automated Supabase security-advisor
check on every push to `main` and as a local pre-push git hook (see the
README's *Pre-push security gate* section), plus GitHub CodeQL static
analysis (`.github/workflows/codeql.yml`) and `npm audit` in CI. Reports
that fall outside what those already catch are especially appreciated.
