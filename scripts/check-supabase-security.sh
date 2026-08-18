#!/usr/bin/env bash
# Strict Supabase security gate — run before every push (wired up as a
# husky pre-push hook, see .husky/pre-push). Uses `supabase db advisors`
# against the LINKED REMOTE project (the same engine that powers the
# Advisors tab in the dashboard and the MCP `get_advisors` tool) so the
# check reflects the database's actual live state, not just the migration
# files in this branch.
#
# Exits non-zero — and blocks the push — on any security advisory at
# warn level or above. See supabase/migrations/20260815030105_fix_rls_anon_bypass.sql
# for the kind of issue this is meant to catch (auth.role() policy gaps,
# SECURITY DEFINER functions callable by anon/authenticated, etc).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PROJECT_REF="$(node -pe "require('./.mcp.json').mcpServers.supabase.url.match(/project_ref=([^&]+)/)[1]" 2>/dev/null || true)"

if [ -z "$PROJECT_REF" ]; then
  echo "❌ Could not determine the Supabase project ref from .mcp.json." >&2
  exit 1
fi

if ! npx --no-install supabase --version >/dev/null 2>&1; then
  echo "❌ Supabase CLI not found. Run 'npm install' to pull in the 'supabase' devDependency." >&2
  exit 1
fi

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  cat >&2 <<'EOF'
❌ SUPABASE_ACCESS_TOKEN is not set — the security gate cannot reach the
   project's live advisors, so the push is being blocked (fail closed).

   Fix:
     1. Generate a personal access token:
        https://supabase.com/dashboard/account/tokens
     2. Export it in your shell profile:
        export SUPABASE_ACCESS_TOKEN=sbp_...

   To bypass intentionally (not recommended): git push --no-verify
EOF
  exit 1
fi

echo "🔎 Linking Supabase CLI to project $PROJECT_REF..."
if ! npx --no-install supabase link --project-ref "$PROJECT_REF" --yes >/tmp/supabase-link.log 2>&1; then
  echo "❌ 'supabase link' failed:" >&2
  cat /tmp/supabase-link.log >&2
  exit 1
fi

echo "🔎 Running Supabase security advisors against the linked project (warn and above, minus scripts/supabase-security-allowlist.json)..."
set +e
npx --no-install supabase db advisors --linked --type security --level warn --fail-on none --output-format json \
  | node scripts/filter-supabase-advisors.mjs
STATUS=$?
set -e

if [ "$STATUS" -ne 0 ]; then
  echo "" >&2
  echo "❌ Supabase security advisors found unlisted issues at warn level or above." >&2
  echo "   Fix them (see supabase-postgres-best-practices / supabase skill security checklist)," >&2
  echo "   add a justified entry to scripts/supabase-security-allowlist.json if it's an" >&2
  echo "   accepted risk, or push with: git push --no-verify" >&2
  exit 1
fi

echo "✅ No blocking Supabase security advisories. Push allowed."
