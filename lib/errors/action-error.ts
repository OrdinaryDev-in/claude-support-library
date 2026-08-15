import * as Sentry from "@sentry/nextjs";

/**
 * Logs the real error (to Sentry, plus the console outside production)
 * and returns a safe, generic message for the client. Never forward raw
 * Postgres/PostgREST error text — constraint/column names, internal
 * schema shape — to the browser.
 */
export function toSafeActionError(
  error: unknown,
  context: Record<string, unknown>,
  fallbackMessage: string
): { ok: false; error: string } {
  Sentry.captureException(error, { extra: context });
  if (process.env.NODE_ENV !== "production") {
    console.error("[action error]", context, error);
  }
  return { ok: false, error: fallbackMessage };
}
