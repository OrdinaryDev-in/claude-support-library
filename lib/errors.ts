/**
 * Server Actions must never forward raw Postgres/Supabase error text
 * (constraint names, column names, driver internals) to the client — it
 * can leak schema details and isn't something a user can act on anyway.
 * Logs the real error server-side (picked up by the hosting platform's
 * function logs today; route to Sentry once observability lands — see
 * the production-readiness plan's Tier 2) and returns a generic,
 * context-specific message safe to show in the UI.
 */
export function safeActionError(
  context: string,
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  console.error(`[${context}]`, error);
  return fallback;
}
