import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database.types";

// Public and redirected away from once signed in (no reason to see the
// login form, or re-consume an OAuth callback, while already authenticated).
const SIGNED_OUT_ONLY_PATHS = ["/login", "/signup", "/callback"];
// Public regardless of auth state — legal pages should stay viewable
// whether or not the visitor is signed in, never bounced to /library.
const ALWAYS_PUBLIC_PATHS = ["/privacy", "/terms"];

/**
 * Refreshes the Supabase session on every request and redirects
 * unauthenticated requests to /login. Called from proxy.ts (Next.js 16's
 * renamed middleware file convention).
 *
 * `requestHeaders` is the original request's headers plus proxy.ts's
 * CSP nonce (see lib/security/csp.ts) — passed through explicitly (rather
 * than read back off `request`) so Next.js's rendering pipeline sees the
 * nonce on every `NextResponse.next({ request })` call below, not just the
 * first one before a cookie refresh replaces `response`.
 */
export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isSignedOutOnlyPath = SIGNED_OUT_ONLY_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isAlwaysPublicPath = ALWAYS_PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (!user && !isSignedOutOnlyPath && !isAlwaysPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isSignedOutOnlyPath) {
    const libraryUrl = request.nextUrl.clone();
    libraryUrl.pathname = "/library";
    libraryUrl.search = "";
    return NextResponse.redirect(libraryUrl);
  }

  return response;
}
