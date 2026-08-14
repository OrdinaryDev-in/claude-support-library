import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
// (exported function `proxy` instead of `middleware`) — see
// node_modules/next/dist/docs/.../proxy.md. Behavior is otherwise the same.
export async function proxy(request: NextRequest) {
  return updateSession(request);
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
