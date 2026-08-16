import type { NextConfig } from "next";

// Content-Security-Policy is set per-request in proxy.ts instead of here —
// it needs a fresh nonce every request, which a static header can't do.
// The headers below are static (same value on every response) and don't
// need that, so they're cheaper to set once here.
const STATIC_SECURITY_HEADERS = [
  // Force HTTPS for a year, including subdomains, and allow browser
  // preload lists — safe once the production domain is confirmed to only
  // ever serve over HTTPS (true for a Vercel deployment).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  // Redundant with CSP's `frame-ancestors 'none'` but kept for older
  // browsers that don't support that CSP directive.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No camera/mic/geolocation/etc. anywhere in this app.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: STATIC_SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
