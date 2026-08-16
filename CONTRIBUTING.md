# Contributing

Thanks for taking the time to contribute. This project is a Next.js +
Supabase app (see [README.md](README.md) for the full stack/architecture
overview) — this file covers the contribution workflow itself.

By participating, you're expected to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

Follow the [Setup](README.md#setup) section in the README first (Supabase
project, env vars, `npm install`, seed data). You'll need:

- Node **22+** (see `.nvmrc`)
- The [Supabase CLI](https://supabase.com/docs/guides/cli) — required for
  local migrations, the E2E test stack, and the pre-push security check
- A `SUPABASE_ACCESS_TOKEN` ([dashboard → account → access tokens](https://supabase.com/dashboard/account/tokens))
  exported in your shell — the pre-push hook (below) needs it

```bash
git clone <your fork>
cd claude-prompt-library
npm install
cp .env.local.example .env.local   # fill in your Supabase project's values
npm run dev
```

## Making a change

1. Branch off `main`: `git checkout -b your-change`.
2. Make your change. Keep PRs focused — one logical change per PR is much
   easier to review than a bundle of unrelated fixes.
3. If you touched `supabase/migrations/`, read the **CI & security** and
   **Pre-push security gate** sections of the README first — this app
   leans on Postgres Row Level Security for authorization, not just
   app-layer checks, so schema/policy changes get extra scrutiny (both
   here and in CI).
4. Run the checks locally before pushing (all of these run in CI too, so
   catching them early saves a round trip):

   ```bash
   npm run lint
   npx next typegen && npx tsc --noEmit
   npm run build
   npm run test           # unit tests (Vitest)
   npm run test:e2e       # Playwright — needs `supabase start && supabase db reset` first
   ```

5. `git push` will trigger a **husky pre-push hook** that runs a Supabase
   security-advisor check against your linked project (see the README's
   *Pre-push security gate* section for exactly what it does and how to
   allowlist a known false positive). It fails closed — no
   `SUPABASE_ACCESS_TOKEN` means the push is blocked, not silently
   allowed. Don't reach for `git push --no-verify` unless you're sure the
   finding is a false positive and you're adding it to
   `scripts/supabase-security-allowlist.json` with a `reason`.

## Commit messages

Write imperative, present-tense summaries that describe *what changed and
why* (see `git log` for the existing style) — e.g. `Fix sign-out redirect
race`, not `fixed bug`. When a fix addresses a root cause rather than a
symptom, say so; it saves the next person from re-discovering the same
dead end. No enforced commit-message format (no Conventional Commits
requirement) — clarity over convention.

## Pull requests

- Describe what changed and why, and call out anything a reviewer should
  pay special attention to (e.g. "this changes an RLS policy").
- Link any related issue.
- CI must pass: lint/type-check/build, unit tests, E2E tests, the
  dependency audit (advisory, non-blocking), and the Supabase security
  gate (blocking).
- Small, incremental PRs get reviewed faster than large ones.

## Reporting bugs / requesting features

Open a GitHub issue. For bugs, include repro steps, what you expected vs.
what happened, and relevant environment details (Node version, browser).

## Reporting a security issue

Please **do not** open a public issue for a security vulnerability
(especially anything related to auth, RLS, or data exposure). See
[SECURITY.md](SECURITY.md) for how to report it privately.

## Project structure

See the [Project structure](README.md#project-structure) section in the
README for a map of the codebase before diving in.
