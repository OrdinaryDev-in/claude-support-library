import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database.types";

// Public and redirected away from once signed in (no reason to see the
// login form, or re-consume an OAuth callback, while already authenticated).
// "Signed in" here means a *real* account (see isRealUser below) — a
// guest's anonymous session must not bounce them away from /login/
// /signup when that's exactly where they're headed to create one.
const SIGNED_OUT_ONLY_PATHS = ["/login", "/signup", "/callback"];
// Public regardless of auth state — legal pages should stay viewable
// whether or not the visitor is signed in, never bounced to /library.
const ALWAYS_PUBLIC_PATHS = ["/privacy", "/terms"];
// Readable without an account — a visitor here with no real session gets
// a Supabase anonymous session created transparently (see below) instead
// of being redirected to /login. Everything else under (app)/ (admin,
// /account, the submission/edit forms) still requires a real account;
// requireUser()-style server-action guards additionally reject an
// anonymous session that reaches them directly.
const GUEST_READABLE_PATHS = ["/library"];

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

  let {
    data: { user },
  } = await supabase.auth.getUser();

  const isServerAction = request.headers.has("next-action");
  const isGuestReadablePath = GUEST_READABLE_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // No session at all, on a route that's supposed to work without an
  // account: create a Supabase anonymous session right here instead of
  // sending the visitor to /login. signInAnonymously() writes the new
  // session's cookies through the same `cookies.setAll` callback wired up
  // above, exactly like a real sign-in would. Skipped for Server Actions —
  // those aren't page navigations a guest session needs to exist for
  // (they're either already guarded by a real getUser() upstream, or by
  // their own requireUser(), which explicitly rejects an anonymous user).
  if (!user && isGuestReadablePath && !isServerAction) {
    const { data } = await supabase.auth.signInAnonymously();
    user = data.user;
  }

  // Downstream Server Components (AppLayout in particular) used to call
  // getUser() again themselves — a second network round trip to Supabase
  // Auth to revalidate the exact session this middleware just validated.
  // Forward the already-verified id instead so they can skip that repeat
  // call. Safe against spoofing: this unconditionally overwrites whatever
  // x-user-id/x-is-guest the client sent (Headers.set replaces, not
  // appends), so the value downstream code sees is always the one *this*
  // getUser()/signInAnonymously() call just verified, never
  // client-supplied. Same mechanism the x-nonce header above already
  // relies on.
  if (user) {
    requestHeaders.set("x-user-id", user.id);
    if (user.is_anonymous) {
      requestHeaders.set("x-is-guest", "1");
    } else {
      requestHeaders.delete("x-is-guest");
    }
  } else {
    requestHeaders.delete("x-user-id");
    requestHeaders.delete("x-is-guest");
  }

  // A *real* signed-in user, as opposed to merely having any session —
  // an anonymous guest session must not satisfy the "already signed in"
  // checks below (the /login-/signup bounce) or count as passing the
  // login gate on a non-guest-readable route (admin, /account, submission
  // forms) the way a real user's session does.
  const isRealUser = Boolean(user) && !user!.is_anonymous;

  // NextResponse.next() copies `request.headers` into
  // `x-middleware-request-*` response headers at construction time, not
  // lazily — so the x-user-id set just above wouldn't reach downstream
  // code through the `response` built earlier (before `user` was known).
  // Rebuild it now that requestHeaders is final, carrying forward any
  // Set-Cookie the session refresh above may have written onto the old one.
  const cookiesToForward = response.cookies.getAll();
  response = NextResponse.next({ request: { headers: requestHeaders } });
  cookiesToForward.forEach((cookie) => response.cookies.set(cookie));

  // Server Actions POST to whatever page they were called from — e.g.
  // AuthForm.tsx calls touchLastLogin() while still on /signup, right
  // after a successful signUp() has already set the session cookie. A
  // page-level redirect below would apply to that request too (user is
  // now truthy, path is /signup → "signed-out-only" bounce), but a
  // Server Action's request isn't a page navigation — it's the app's own
  // fetch expecting a specific RSC/action response back. Next's
  // client-side action handler can't parse a bare redirect as a valid
  // action response, and throws a generic, unhelpful "An unexpected
  // response was received from the server." with no indication of why
  // (confirmed by reading node_modules/next/dist/.../server-action-
  // reducer.js — it falls back to that exact message whenever the
  // response isn't RSC-shaped and isn't Next's own action-redirect
  // format). Skip both page-level redirects for these requests
  // entirely and let the action run — the actions themselves are the
  // real authorization boundary (see app/actions/*.ts's own auth
  // checks and RLS), this redirect is only ever a page-navigation UX
  // nicety, never a security gate.
  const isSignedOutOnlyPath = SIGNED_OUT_ONLY_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );
  const isAlwaysPublicPath = ALWAYS_PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Guest-readable paths are exempted here rather than folded into
  // `isRealUser` above: a guest's anonymous session already satisfies
  // `user` truthy on these routes (created earlier in this function), so
  // no redirect is needed regardless of isRealUser — but everywhere else
  // under (app)/ (admin, /account, submission/edit forms) still requires
  // a *real* account, even though a guest's anonymous session cookie is
  // present there too (it's a normal cookie, sent on every request, not
  // scoped to /library).
  if (
    !isServerAction &&
    !isRealUser &&
    !isGuestReadablePath &&
    !isSignedOutOnlyPath &&
    !isAlwaysPublicPath
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Only a *real* user gets bounced off /login-/signup/callback — a guest
  // heading there specifically wants to turn their anonymous session into
  // a real account and must be allowed to see the form.
  if (!isServerAction && isRealUser && isSignedOutOnlyPath) {
    const libraryUrl = request.nextUrl.clone();
    libraryUrl.pathname = "/library";
    libraryUrl.search = "";
    return NextResponse.redirect(libraryUrl);
  }

  return response;
}
