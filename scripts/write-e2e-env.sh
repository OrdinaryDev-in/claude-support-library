#!/usr/bin/env bash
# Regenerates .env.test.local from the running local Supabase stack.
# Run automatically by playwright.config.ts's webServer, every time,
# before build+start — not something you run manually.
#
# Why this exists instead of relying on the shell that runs
# `npm run test:e2e` having the right vars exported: that turned out to
# be unreliable in practice across two separate debugging rounds (a
# quoted value, then a value that plain didn't survive into the actual
# `next build` process no matter how it was sourced). Writing a real
# .env.test.local file and forcing NODE_ENV=test (set in
# playwright.config.ts's webServer.env) makes Next.js skip .env.local
# ENTIRELY rather than trying to out-prioritize it — see
# https://nextjs.org/docs/app/guides/environment-variables#test-environment-variables.
# This removes the current shell's environment from the equation
# completely; the only prerequisite left is `supabase start` actually
# running, checked directly below.
#
# This check used to live in a Playwright `globalSetup` file instead, on
# the theory that globalSetup runs before webServer starts. That's wrong
# for the installed Playwright version — its task runner starts the
# webServer plugin (which runs *this* script) before running globalSetup
# (confirmed by reading node_modules/playwright/lib/runner/index.js's
# createGlobalSetupTasks: plugin-setup tasks precede globalSetups). So the
# check has to live here, at the actual first thing webServer runs, to
# fail fast with an actionable message instead of a cryptic CLI error deep
# in `supabase status` or a 60-180s webServer timeout.
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
