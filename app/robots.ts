import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// proxy.ts (lib/supabase/middleware.ts's updateSession) redirects every
// unauthenticated request to /login except /login, /signup, /callback,
// /privacy, /terms — so /library, /account, and /admin are never actually
// reachable by an anonymous crawler in the first place; a request there
// just becomes a redirect chain ending at /login. Disallowing them here
// isn't hiding anything, it's telling crawlers not to waste a crawl
// budget on URLs that only ever resolve to the same login page.
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
