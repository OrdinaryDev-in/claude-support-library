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
     * Run on every request except static assets and image optimization
     * files, so auth gating never blocks CSS/JS/images from loading.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
