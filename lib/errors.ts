import { logError } from "@/lib/data/error-logs";

/**
 * Server Actions must never forward raw Postgres/Supabase error text
 * (constraint names, column names, driver internals) to the client — it
 * can leak schema details and isn't something a user can act on anyway.
 * Logs the real error server-side (picked up by the hosting platform's
 * function logs, and — since 20260818110500_error_logs.sql — persisted to
 * public.error_logs too, see lib/data/error-logs.ts) and returns a
 * generic, context-specific message safe to show in the UI.
 *
 * Stays synchronous: every call site uses this inline as
 * `return { ok: false, error: safeActionError(...) }`, so the DB write
 * is fired-and-forgotten (`void logError(...)`) rather than awaited —
 * a slow or failing log write must never delay or break the actual
 * user-facing response.
 */
export function safeActionError(
  context: string,
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  console.error(`[${context}]`, error);
  void logError({ context, message: errorMessage(error) });
  return fallback;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}
