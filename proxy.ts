import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp } from "@/lib/security/csp";

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
// (exported function `proxy` instead of `middleware`) — see
// node_modules/next/dist/docs/.../proxy.md. Behavior is otherwise the same.
export async function proxy(request: NextRequest) {
  const { nonce, header: csp } = buildCsp();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = await updateSession(request, requestHeaders);

  // Report-only until CSP_ENFORCE=true is set (env var, no redeploy
  // needed) — flip once a deploy cycle has produced zero unexpected
  // violation reports. See lib/security/csp.ts for the policy itself.
  const cspHeaderName =
    process.env.CSP_ENFORCE === "true"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";
  response.headers.set(cspHeaderName, csp);

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every request except static assets, image optimization
     * files, and the generated icon/opengraph-image/robots/sitemap
     * routes, so auth gating never blocks CSS/JS/images — or the
     * social-preview image, or search-engine crawling — from working.
     * opengraph-image/robots.txt/sitemap.xml have no fixed extension in
     * their URLs (unlike icon.svg/apple-icon.png, already caught by the
     * extension alternation below), so each needs its own explicit
     * exclusion. Confirmed by hand: without the robots/sitemap
     * exclusions, an unauthenticated GET to /robots.txt got a 307 to
     * /login instead of the actual file — Googlebot has no session, so
     * app/robots.ts and app/sitemap.ts (and the disallow rules /robots.txt
     * itself declares) would never actually be reachable.
     */
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
