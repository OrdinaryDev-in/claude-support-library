## What changed and why

<!-- Summarize the change and the reasoning. If it fixes a root cause
     rather than a symptom, say so — see CONTRIBUTING.md's commit-message
     guidance. -->

## Related issue

<!-- Closes #... , or "N/A" -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Refactor / cleanup (no behavior change)
- [ ] Docs / tooling / CI

## Touches auth, RLS, or migrations?

<!-- If this PR changes anything under supabase/migrations/, proxy.ts,
     lib/supabase/, or app/actions/ (the RLS + Server Action authorization
     boundary — see README's "CI & security" section), describe the
     security implications here. Otherwise, delete this section. -->

- [ ] This PR is unrelated to auth / RLS / migrations
- [ ] This PR touches auth / RLS / migrations — details below:

## How was this tested?

- [ ] `npm run test` (unit tests)
- [ ] `npm run test:e2e` (Playwright, against a local Supabase stack)
- [ ] Manual testing — describe steps below

## Checklist

- [ ] `npm run lint` and `npx tsc --noEmit` pass locally
- [ ] `npm run build` succeeds
- [ ] I've read [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] New/changed behavior has test coverage, or I've explained why not
