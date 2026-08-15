import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
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
