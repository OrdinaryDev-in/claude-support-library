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

/** Best-effort client IP from standard proxy headers (Vercel sets
 * x-forwarded-for). Falls back to a shared bucket rather than "no
 * limit at all" when the header's missing, so failure mode is more
 * restrictive, not less.
 *
 * Takes a headers object directly (not a `Request`) so the same helper
 * works from both a Route Handler (`request.headers`, e.g.
 * app/(auth)/callback/route.ts) and a Server Action, which only has
 * `next/headers`' `headers()` — there's no `Request` to pull headers off
 * in that context. `Pick<Headers, "get">` is the minimal shape both
 * `Headers` and Next's `ReadonlyHeaders` structurally satisfy. */
export function getClientIp(headers: Pick<Headers, "get">): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
