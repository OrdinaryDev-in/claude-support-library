import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// proxy.ts (lib/supabase/middleware.ts's updateSession) redirects every
// unauthenticated request to /login except /login, /signup, /callback,
// /privacy, /terms, and /library (guest-readable — an anonymous crawler
// there gets a throwaway Supabase anonymous session instead of a
// redirect). /account and /admin still always resolve to a /login
// redirect chain for a crawler. Disallowing all of these here isn't
// hiding anything: /account and /admin genuinely never render anything
// but the login page for a crawler, and /library's content is
// user-submitted, churns constantly, and is better discovered by users
// browsing than indexed — not worth the crawl budget either way.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup", "/privacy", "/terms"],
      disallow: ["/library", "/account", "/admin", "/callback"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
