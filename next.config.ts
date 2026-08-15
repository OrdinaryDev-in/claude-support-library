import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

function supabaseHost(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
}

// Built once per config evaluation (build / next dev boot), not per
// request — env vars here are read from the server process, so the
// NEXT_PUBLIC_ prefix's "inline into the client bundle" behavior doesn't
// apply to this read; it just means process.env.* is available.
function buildCsp(): string {
  const supabase = supabaseHost();
  const sentryConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);
  const isDev = process.env.NODE_ENV !== "production";

  const connectSrc = [
    "'self'",
    supabase && `https://${supabase}`,
    // Only added once a real Sentry project exists — narrow this to the
    // exact ingest host from the DSN once one does.
    sentryConfigured && "https://*.ingest.sentry.io",
    sentryConfigured && "https://*.ingest.us.sentry.io",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    // Next's inline hydration bootstrap scripts need 'unsafe-inline'
    // without a nonce-based setup (a stronger follow-up that touches
    // proxy.ts's session-refresh matcher — out of scope here).
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    // app/layout.tsx sets font CSS variables via an inline style={{}}
    // attribute on <html> — CSP's style-src governs that too.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    // next/font/google self-hosts font files at build time — no runtime
    // requests to Google, so no fonts.gstatic.com allowance needed.
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: buildCsp() },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Stays fully inert (no build-time network calls, no noisy logs) when
  // SENTRY_AUTH_TOKEN is unset, which it is until a Sentry project exists.
  // (disableLogger is deprecated and unsupported under Turbopack, which
  // this app builds with — omitted rather than set.)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
