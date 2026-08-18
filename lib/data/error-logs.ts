import { createClient } from "@/lib/supabase/server";

/**
 * Best-effort persistence into public.error_logs (0021_error_logs.sql) —
 * the zero-dependency floor for PRODUCTION_CHECKLIST.md's "real error
 * tracking" item until/unless a service like Sentry is added. Called from
 * two places: lib/errors.ts's safeActionError() (every Server Action
 * failure) and app/actions/errors.ts's logClientError() (the App Router
 * error boundaries, via a Server Action since they run client-side).
 *
 * Deliberately swallows its own failures — a broken logging path must
 * never turn into a second, worse error on top of the one being reported,
 * or (worse) surface as the actual response a Server Action returns to
 * the client. Falls back to console.error, which is exactly what already
 * happened before this existed.
 */
export async function logError(entry: {
  context: string;
  message: string;
  digest?: string | null;
  path?: string | null;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("error_logs").insert({
      context: entry.context,
      message: entry.message.slice(0, 4000),
      digest: entry.digest ?? null,
      path: entry.path ?? null,
      user_id: user?.id ?? null,
    });

    if (error) {
      console.error("[logError] failed to persist error log:", error);
    }
  } catch (loggingError) {
    console.error("[logError] threw while persisting error log:", loggingError);
  }
}
