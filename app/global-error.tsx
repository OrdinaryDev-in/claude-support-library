"use client";

import { useEffect } from "react";
import { logClientError } from "@/app/actions/errors";

// Last-resort fallback: only fires when app/layout.tsx *itself* throws
// (a plain app/error.tsx can't catch that — it's rendered by the layout
// it's meant to protect). Must render its own <html>/<body>, since the
// root layout — the thing that normally provides them — is what failed.
// Inline styles with the design tokens' actual hex values, not Tailwind
// classes or var(--...) references: this is the one boundary that has to
// assume nothing else in the app (globals.css, font loading, Tailwind's
// own build output) is trustworthy. Same error-persistence note as
// app/error.tsx — this is the other place logClientError()/eventually
// Sentry.captureException() goes. logClientError() itself never throws
// (see lib/data/error-logs.ts), so it can't take this fallback down with it.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    void logClientError({
      context: "app/global-error.tsx",
      message: error.message,
      digest: error.digest,
      path: typeof window !== "undefined" ? window.location.pathname : null,
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#14181f", color: "#edeef2", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 640, margin: "96px auto", padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 500, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: "#8a90a0", marginBottom: 24, lineHeight: 1.6 }}>
            A critical error occurred. Try reloading the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 20px",
              border: "1px solid #e8a33d",
              color: "#e8a33d",
              borderRadius: 6,
              background: "transparent",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
