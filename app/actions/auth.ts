"use server";

import { headers } from "next/headers";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

/** Pre-flight rate-limit check AuthForm.tsx calls before attempting a
 * login/signup submission. The actual credential check still runs
 * client-side directly against Supabase's Auth API — signUp()'s
 * emailRedirectTo option needs window.location.origin, which doesn't
 * exist server-side, so that part can't move into this action — but the
 * app-level throttle itself can: this is the one piece of the flow that
 * *can* run server-side, on top of whatever GoTrue's own platform limits
 * already provide. Same IP-based bucket/window as
 * app/(auth)/callback/route.ts, this app's other unauthenticated auth
 * entry point; login and signup get separate buckets per IP so hitting
 * one doesn't lock out the other. */
export async function checkAuthRateLimit(
  bucket: "login" | "signup"
): Promise<{ allowed: boolean }> {
  const ip = getClientIp(await headers());
  return checkRateLimit(`${bucket}:${ip}`, { max: 10, windowMs: 60_000 });
}
