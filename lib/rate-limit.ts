import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";

/**
 * Checks (and increments) a fixed-window rate-limit bucket via the
 * Postgres-backed `check_rate_limit` RPC (supabase/migrations/0008_rate_limiting.sql).
 *
 * `identity` must be the caller's own auth.uid() for authenticated
 * buckets — the RPC enforces that server-side — or an IP string for the
 * anonymous `"callback"` bucket.
 *
 * Fails OPEN on infrastructure errors (network/DB issues, unexpected
 * RPC errors): a rate-limiter outage should not become a self-inflicted
 * denial of service for every user. The error is still reported.
 */
export async function checkRateLimit(
  bucket: string,
  identity: string,
  maxHits: number,
  windowSeconds: number
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_bucket: bucket,
    p_identity: identity,
    p_max_hits: maxHits,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    Sentry.captureException(error, { extra: { bucket, action: "checkRateLimit" } });
    return true;
  }

  return data === true;
}
