"use server";

import { headers } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

/** Pre-flight rate-limit check AuthForm.tsx calls before attempting a
 * login/signup submission. The actual credential check still runs
 * client-side directly against Supabase's Auth API — signUp()'s
 * emailRedirectTo option needs window.location.origin, which doesn't
 * exist server-side, so that part can't move into this action — but the
 * app-level throttle itself can: this is the one piece of the flow that
 * *can* run server-side, on top of whatever GoTrue's own platform limits
 * already provide. Same IP-based bucket/window as
 * app/(auth)/callback/route.ts, this app's other unauthenticated auth
 * entry point; login and signup get separate buckets per IP so hitting
 * one doesn't lock out the other. */
// Two full E2E journeys now share one dev-server process/IP for the
// duration of a single `npm run test:e2e` run (e2e/core-flows.spec.ts +
// e2e/skills-flow.spec.ts, added in Phase 2 — each does several logins by
// design, see either file's login() helper), which pushed the combined
// login count for one CI run past this bucket's real max=10 window. Widen
// it only under E2E_TEST_MODE — a dedicated flag the test:e2e script sets
// (package.json), deliberately NOT NODE_ENV=test: Vitest's unit tests
// (app/actions/auth.test.ts) already assert the real max=10 behavior and
// also run under NODE_ENV=test, so reusing that value here would silently
// break them instead of just the E2E run. Production traffic sets neither.
const AUTH_RATE_LIMIT =
  process.env.E2E_TEST_MODE === "true" ? { max: 100, windowMs: 60_000 } : { max: 10, windowMs: 60_000 };

export async function checkAuthRateLimit(
  bucket: "login" | "signup"
): Promise<{ allowed: boolean }> {
  const ip = getClientIp(await headers());
  return checkRateLimit(`${bucket}:${ip}`, AUTH_RATE_LIMIT);
}
