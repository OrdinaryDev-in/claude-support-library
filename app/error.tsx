"use client";

import { useEffect } from "react";

// Catches a render/runtime error anywhere under app/ that isn't caught by
// a more specific error.tsx in its own segment. Must be a Client
// Component (Next.js requirement — it needs reset(), a closure over
// React state). This is also PRODUCTION_CHECKLIST.md's "no App Router
// error boundaries" gap closed for the render-error half of it; the
// still-open half is wiring an actual reporting service (Sentry or
// equivalent) into the effect below — right now it only reaches the
// server/browser's own logs, which is the same "log server-side, generic
// message to the user" shape lib/errors.ts's safeActionError() already
// uses for server action failures. If Sentry gets added, this is where
// Sentry.captureException(error) goes.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 w-full mx-auto max-w-[640px] px-4 sm:px-8 py-24 text-center">
      <div className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--danger)] tracking-wider uppercase mb-3">
        § Error
      </div>
      <h1 className="font-[family-name:var(--font-display)] font-medium text-3xl sm:text-[36px] mb-3">
        Something went wrong
      </h1>
      <p className="text-sm text-[var(--muted)] leading-relaxed mb-8">
        An unexpected error occurred. Try again, or head back to the library.
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="px-4 py-2 rounded-md border border-[var(--brass)] text-[var(--brass)] text-[13px] font-semibold hover:bg-[var(--brass)]/10 transition-colors"
        >
          Try again
        </button>
        <a
          href="/library"
          className="px-4 py-2 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px] no-underline"
        >
          Back to the library
        </a>
      </div>
    </div>
  );
}
