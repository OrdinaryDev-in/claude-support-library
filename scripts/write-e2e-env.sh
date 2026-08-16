#!/usr/bin/env bash
# Regenerates .env.test.local from the running local Supabase stack.
# Run by `npm run test:e2e` (package.json) BEFORE `playwright test` even
# starts — not something you run manually, and not run from inside
# playwright.config.ts or webServer.command. That placement matters: two
# separate things need what this writes —
#  1. playwright.config.ts loads .env.test.local into its own process (via
#     @next/env's loadEnvConfig) so e2e/core-flows.spec.ts's own
#     process.env reads (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#     — it builds its own admin supabase-js client) actually see it. That
#     only works if the file already exists before playwright.config.ts's
#     top-level code runs, i.e. before `playwright test` starts at all.
#  2. webServer's `npm run build && npm run start`, via NODE_ENV=test,
#     picks up the same file for the Next.js app itself.
#
# Why a real file instead of relying on the invoking shell's own exported
# vars: that turned out to be unreliable in practice across two separate
# earlier debugging rounds (a quoted value, then a value that plainly
# didn't survive into the actual `next build` process no matter how it was
# sourced). NODE_ENV=test makes Next.js skip .env.local ENTIRELY rather
# than trying to out-prioritize it — see
# https://nextjs.org/docs/app/guides/environment-variables#test-environment-variables.
# This removes the current shell's environment from the equation
# completely; the only prerequisite left is `supabase start` actually
# running, checked directly below.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

LOCAL_SUPABASE_URL="http://127.0.0.1:54321"
# No -f: PostgREST answers unauthenticated requests with 401, which still
# means "reachable" — only a connection failure (no -f, nonzero exit) means
# the stack isn't up.
if ! curl -sS --max-time 3 "${LOCAL_SUPABASE_URL}/rest/v1/" -o /dev/null 2>/dev/null; then
  # >&2: Playwright's webServer plugin only surfaces a child's stdout when
  # DEBUG=pw:webserver or webServer.stdout:"pipe" is set, but shows stderr
  # by default — confirmed by reading its source (see comment above). An
  # error belongs on stderr regardless; this also happens to be what makes
  # it actually visible to whoever runs `npm run test:e2e` without either
  # of those flags set.
  {
    echo ""
    echo "❌ No local Supabase stack reachable at ${LOCAL_SUPABASE_URL}."
    echo ""
    echo "Run this first (see README.md's Testing section):"
    echo ""
    echo "  supabase start && supabase db reset"
    echo "  npm run test:e2e"
    echo ""
  } >&2
  exit 1
fi

npx supabase status -o env \
  --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
  --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY \
  > .env.test.local

echo "Wrote .env.test.local from the local Supabase stack."
