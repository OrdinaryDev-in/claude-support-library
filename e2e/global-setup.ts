/**
 * Runs once before webServer starts / any test runs. Validates the env
 * vars e2e/core-flows.spec.ts and the app itself need, and fails
 * immediately with an actionable message if they're missing or
 * malformed — instead of Next's server crashing deep inside a request
 * handler on every hit, which Playwright then reports as an opaque
 * "Timed out waiting 60000ms from config.webServer" with a stack trace
 * that doesn't say *why*. Two real failures hit this exact way already:
 * a quoted URL value, then a missing/invalid one entirely.
 */
function fail(message: string): never {
  console.error(
    `\n❌ e2e/global-setup.ts: ${message}\n\n` +
      "Run this first (see README.md's Testing section):\n\n" +
      "  supabase start && supabase db reset\n" +
      "  set -a\n" +
      "  source <(supabase status -o env \\\n" +
      "    --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \\\n" +
      "    --override-name auth.anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY \\\n" +
      "    --override-name auth.service_role_key=SUPABASE_SERVICE_ROLE_KEY)\n" +
      "  set +a\n\n" +
      "Then run `npm run test:e2e` in that SAME shell — `source` only\n" +
      "affects the shell session it ran in, not other terminals or new\n" +
      "ones opened afterward.\n"
  );
  process.exit(1);
}

export default function globalSetup() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;

  for (const name of required) {
    if (!process.env[name]?.trim()) {
      fail(`${name} is not set (or empty) in this shell.`);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("not http(s)");
  } catch {
    fail(`NEXT_PUBLIC_SUPABASE_URL is set but not a valid http(s) URL (got: ${JSON.stringify(url)}).`);
  }

  if (!/^(127\.0\.0\.1|localhost)$/.test(new URL(url).hostname)) {
    fail(
      `NEXT_PUBLIC_SUPABASE_URL (${url}) isn't a local Supabase stack. ` +
        "This test suite signs up throwaway accounts and must never run against a real project."
    );
  }
}
