import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { touchLastLogin } from "@/app/actions/profile";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

// Fires for both OAuth redirects and email-confirmation links — exchanges
// the auth `code` for a session, then sends the user on to `next`.
//
// Rate-limited below to slow down code-guessing/replay attempts. /login
// and /signup's own credential checks still run client-side directly
// against Supabase's Auth API (components/auth/AuthForm.tsx) — the
// emailRedirectTo option signUp() needs is only knowable from
// window.location.origin — but app/actions/auth.ts's checkAuthRateLimit()
// gives those two the same app-level throttle this route has, via a
// Server Action the client calls as a pre-flight check before submitting.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/library";

  const { allowed } = checkRateLimit(`callback:${getClientIp(request.headers)}`, {
    max: 10,
    windowMs: 60_000,
  });
  if (!allowed) {
    return NextResponse.redirect(`${origin}/login?error=rate_limited`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await touchLastLogin();
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
