/**
 * The app's canonical public origin — needed absolute (not relative) for
 * `metadataBase` (app/layout.tsx), app/sitemap.ts, and app/robots.ts.
 *
 * Prefers an explicit override (NEXT_PUBLIC_SITE_URL), then Vercel's own
 * auto-injected production-domain env var (no manual deploy step needed
 * on Vercel — see PRODUCTION_CHECKLIST.md's "double-check Vercel env
 * vars" item, which this deliberately avoids adding to), then localhost
 * for local dev.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null) ??
  "http://localhost:3000"
).replace(/\/$/, "");
