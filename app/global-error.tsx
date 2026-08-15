"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Catches errors thrown by the root layout itself — per the App Router
// convention it must render its own <html>/<body>, since it fully
// replaces the root layout when active. Deliberately self-contained
// (no next/font variables, no Tailwind custom-property reliance): if the
// root layout crashed, we can't assume its setup ran.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#14181f",
          color: "#edeef2",
          fontFamily: "system-ui, sans-serif",
          padding: "2.5rem 1rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 380 }}>
          <p style={{ fontSize: 14, color: "#8a90a0", marginBottom: 8 }}>
            A critical error occurred.
          </p>
          <p style={{ fontSize: 13, color: "#8a90a0" }}>
            Please reload the page. If this keeps happening, try again later.
          </p>
        </div>
      </body>
    </html>
  );
}
