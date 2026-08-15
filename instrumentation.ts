import * as Sentry from "@sentry/nextjs";

// Next.js's own instrumentation hook (https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
// Current @sentry/nextjs convention (v10+) calls Sentry.init() directly
// inside register() for both runtimes, rather than in separate
// sentry.server.config.ts / sentry.edge.config.ts files — the SDK warns
// and asks you to migrate off those if it finds them.
//
// Fully inert until SENTRY_DSN is set: `enabled` is explicit rather than
// relying on empty-string-DSN behavior, so this is safe to ship with no
// Sentry account configured yet.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN || undefined,
      enabled: Boolean(process.env.SENTRY_DSN),
      tracesSampleRate: 0, // no perf tracing yet — keep the initial rollout minimal
    });
  }
}

// Reports errors that escape uncaught during rendering/routing (Server
// Components, Route Handlers, Server Actions). Complements — doesn't
// replace — the explicit Sentry.captureException calls in
// lib/errors/action-error.ts, which log errors server actions catch and
// handle themselves rather than let escape.
export const onRequestError = Sentry.captureRequestError;
