/**
 * The app's canonical public origin — needed absolute (not relative) for
 * `metadataBase` (app/layout.tsx), app/sitemap.ts, and app/robots.ts.
 *
 * atlas.ordinarydev.in is the project's real, primary production domain
 * (added as a custom domain 2026-08-18) — hardcoded as the fallback so
 * metadata/sitemap/robots resolve correctly on any deploy even without
 * NEXT_PUBLIC_SITE_URL set. `NEXT_PUBLIC_SITE_URL` still overrides it if
 * ever set (e.g. the domain changes later, or a staging deploy wants a
 * different value) — no code change needed for that, just the env var.
 * Localhost only applies to an actual local dev server.
 */
const PRODUCTION_SITE_URL = "https://atlas.ordinarydev.in";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NODE_ENV === "development" ? "http://localhost:3000" : PRODUCTION_SITE_URL)
).replace(/\/$/, "");
