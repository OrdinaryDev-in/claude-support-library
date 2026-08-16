import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { touchLastLogin } from "@/app/actions/profile";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

// Fires for both OAuth redirects and email-confirmation links — exchanges
// the auth `code` for a session, then sends the user on to `next`.
//
// This is the one auth entry point that's an actual unauthenticated
// Next.js server endpoint doing real work (exchanging a code for a
// session) — rate-limited below to slow down code-guessing/replay
// attempts. /login and /signup's own credential checks run client-side
// directly against Supabase's Auth API (components/auth/AuthForm.tsx),
// which already has its own platform-level rate limits (see the
// production-readiness plan) — there's no additional Next.js server code
// path to rate-limit for those without routing them through our server
// too, which this change doesn't do.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/library";

  const { allowed } = checkRateLimit(`callback:${getClientIp(request)}`, {
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
