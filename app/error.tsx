"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Segment error boundary — catches errors thrown anywhere below the root
// layout (covers both the (app) and (auth) route groups, since Next
// nests error boundaries per segment). Reports to Sentry (a no-op until
// SENTRY_DSN is configured) and offers a retry.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)] text-[var(--text)] px-4 py-10">
      <div className="w-full max-w-[380px] bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-7 sm:p-9 text-center">
        <div className="font-[family-name:var(--font-mono)] text-xs text-[var(--danger)] tracking-wider uppercase mb-2">
          Something went wrong
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">
          An unexpected error occurred. You can try again, or head back to the
          library.
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="py-2.5 rounded-md border border-[var(--brass)] text-[var(--brass)] text-[13px] font-semibold hover:bg-[var(--brass)]/10 transition-colors"
          >
            Try again
          </button>
          <a
            href="/library"
            className="py-2.5 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px] hover:bg-white/[0.03] transition-colors"
          >
            Back to the library
          </a>
        </div>
      </div>
    </div>
  );
}
