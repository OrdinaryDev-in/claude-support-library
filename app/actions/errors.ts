"use server";

import { logError } from "@/lib/data/error-logs";

/** Server Action app/error.tsx and app/global-error.tsx call from their
 * effects — those are Client Components (a Next.js requirement for error
 * boundaries), so they can't import lib/data/error-logs.ts's
 * server-only createClient() directly; this is the bridge. Same
 * best-effort, never-throws contract as safeActionError() (lib/errors.ts) —
 * a failure here must never compound the error the boundary is already
 * showing the user. */
export async function logClientError(entry: {
  context: string;
  message: string;
  digest?: string | null;
  path?: string | null;
}): Promise<void> {
  await logError(entry);
}
