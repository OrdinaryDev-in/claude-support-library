import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { touchLastLogin } from "@/app/actions/profile";
import { checkRateLimit } from "@/lib/rate-limit";

// Fires for both OAuth redirects and email-confirmation links — exchanges
// the auth `code` for a session, then sends the user on to `next`. This
// route runs on our own server (unlike sign-in/sign-up, which the
// browser sends straight to Supabase's Auth API), so it's a viable spot
// for app-layer rate limiting of repeated bad `code` attempts.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/library";

  // NextRequest.ip was removed in recent Next.js versions — read the
  // header Vercel (and most proxies) set directly.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const withinLimit = await checkRateLimit("callback", ip, 10, 300);
  if (!withinLimit) {
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
