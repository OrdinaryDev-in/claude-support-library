/**
 * A minimal, in-memory, per-instance rate limiter — deliberately simple,
 * with zero new infrastructure to provision (no Redis/Upstash account).
 * Good enough as an interim measure, but has a real limitation worth
 * knowing: each warm serverless instance keeps its own separate counter,
 * so under real concurrent traffic spread across many instances the
 * effective limit is higher than `max`, not a hard global cap. A properly
 * distributed limiter (e.g. Upstash Redis + @upstash/ratelimit) is the
 * correct long-term fix — see the production-readiness plan.
 */
const hits = new Map<string, { count: number; resetAt: number }>();

// Opportunistic cleanup so `hits` doesn't grow unbounded for the life of
// a warm instance — runs at most once a minute, piggybacking on a real
// check rather than a timer (no background work to leak/clean up).
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, entry] of hits) {
    if (entry.resetAt <= now) hits.delete(key);
  }
}

/** Test-only: clears the in-memory store between test cases. Without this,
 * tests that reuse the same fixture user id/IP across multiple `it()`
 * blocks in one file (common in this repo's auth-boundary suites — see
 * app/actions/prompts.test.ts, app/actions/review.test.ts) accumulate hits
 * toward the same bucket across unrelated tests, since this module's `hits`
 * Map is a real singleton, not something vi.clearAllMocks() touches. */
export function __resetRateLimitStoreForTests() {
  hits.clear();
}

export function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number }
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  sweep(now);

  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: max - entry.count };
}

/** Best-effort client IP from standard proxy headers. Falls back to a
 * shared "unknown" bucket rather than "no limit at all" when no header is
 * present, so failure mode is more restrictive, not less.
 *
 * Takes a headers object directly (not a `Request`) so the same helper
 * works from both a Route Handler (`request.headers`, e.g.
 * app/(auth)/callback/route.ts) and a Server Action, which only has
 * `next/headers`' `headers()` — there's no `Request` to pull headers off
 * in that context. `Pick<Headers, "get">` is the minimal shape both
 * `Headers` and Next's `ReadonlyHeaders` structurally satisfy.
 *
 * Prefers `x-vercel-forwarded-for` over `x-forwarded-for`: per Vercel's
 * own docs (vercel.com/docs/headers/request-headers), Vercel overwrites
 * `x-forwarded-for` at its edge and does not forward client-supplied
 * values — safe as-is for a request that reaches this deployment
 * directly — but that guarantee only holds for traffic terminating at
 * Vercel's edge first. If anything sits in front of Vercel (another
 * proxy/CDN) or this code runs outside Vercel (local dev, self-hosted,
 * a different host), `x-forwarded-for` reverts to a plain
 * client-supplied header — split(",")[0] would then return whatever an
 * attacker put first, letting them mint a fresh rate-limit bucket on
 * every request by sending a different value each time.
 * `x-vercel-forwarded-for` is Vercel's dedicated variant that stays
 * accurate even behind an extra proxy layer, so prefer it whenever
 * present; `x-forwarded-for` remains a reasonable fallback (correct on
 * direct Vercel traffic, and on other platforms with an equivalent
 * guarantee). */
export function getClientIp(headers: Pick<Headers, "get">): string {
  const vercelForwardedFor = headers.get("x-vercel-forwarded-for");
  if (vercelForwardedFor) return vercelForwardedFor.split(",")[0].trim();
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
