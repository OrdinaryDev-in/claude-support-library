import * as Sentry from "@sentry/nextjs";

// Current @sentry/nextjs convention (v10+): Sentry.init() belongs here,
// not in a separate sentry.client.config.ts (the SDK warns if it finds
// both, and recommends this file exclusively).
//
// Fully inert until NEXT_PUBLIC_SENTRY_DSN is set.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
