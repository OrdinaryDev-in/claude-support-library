import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Deliberately only the truly public pages. `/` just redirects to
// `/library` (auth-gated — see app/robots.ts's comment), and everything
// under /library, /account, /admin requires a signed-in session per
// proxy.ts, so a crawler can never actually reach them regardless of
// whether they're listed here — listing an unreachable URL in a sitemap
// is worse than not listing it (Google Search Console flags it as a
// crawl error). If prompt content ever becomes genuinely public browsing
// (no login required), that's the point to add per-prompt entries here
// via a DB query, not before.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/login", "/signup", "/privacy", "/terms"];
  const lastModified = new Date();
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified,
    changeFrequency: "monthly",
  }));
}
