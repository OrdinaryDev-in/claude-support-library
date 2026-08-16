"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { touchLastLogin } from "@/app/actions/profile";
import { checkAuthRateLimit } from "@/app/actions/auth";

type Mode = "login" | "signup";

// Google/GitHub aren't enabled in the Supabase dashboard yet (clicking
// these currently hits a live "provider is not enabled" error) — hidden
// for launch. signInWithOAuth wiring below is left in place; flip this
// back to true once the providers are configured with production
// callback URLs (see README's OAuth setup notes).
const OAUTH_ENABLED = false;

export function AuthForm({ mode }: { mode: Mode }) {
  const isLogin = mode === "login";
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/library";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleOAuth(provider: "google" | "github") {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setError(error.message);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const { allowed } = await checkAuthRateLimit(isLogin ? "login" : "signup");
    if (!allowed) {
      setError("Too many attempts. Please wait a minute and try again.");
      setPending(false);
      return;
    }

    const supabase = createClient();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setPending(false);
        return;
      }
      await touchLastLogin();
      // A hard navigation, not router.push()+refresh(): the client router
      // can serve `next` from a cache populated before signInWithPassword
      // set the auth cookie, so proxy.ts's session check on that navigation
      // still sees no user and the redirect doesn't visibly apply until a
      // manual reload. A full navigation always re-runs proxy.ts fresh.
      window.location.assign(next);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // Without this, the confirmation email redirects to the project's
        // default Site URL (its bare origin), landing on `/` or `/login`
        // instead of `/callback` — the code then never gets exchanged for
        // a session via app/(auth)/callback/route.ts.
        emailRedirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }
    if (!data.session) {
      // Email confirmation is required before a session exists.
      setCheckEmail(true);
      setPending(false);
      return;
    }
    await touchLastLogin();
    window.location.assign(next);
  }

  if (checkEmail) {
    return (
      <div className="text-center">
        <div className="font-[family-name:var(--font-mono)] text-xs text-[var(--brass)] tracking-wider uppercase mb-2">
          Almost there
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Confirm your account by following the link we just sent to{" "}
          <span className="text-[var(--text)]">{email}</span>.
        </p>
      </div>
    );
  }

  return (
    <>
      {OAUTH_ENABLED && (
        <>
          <div className="flex flex-col gap-2.5 mb-5">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex items-center justify-center gap-2 py-2.5 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px] hover:bg-white/[0.03] transition-colors"
            >
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("github")}
              className="flex items-center justify-center gap-2 py-2.5 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px] hover:bg-white/[0.03] transition-colors"
            >
              Continue with GitHub
            </button>
          </div>

          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)]">OR</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {!isLogin && (
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1.5">Full name</label>
            <input
              className="dv-input"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1.5">Email</label>
          <input
            type="email"
            className="dv-input"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1.5">Password</label>
          <input
            type="password"
            className="dv-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        {error && <div className="text-xs text-[var(--danger)]">{error}</div>}

        <button
          type="submit"
          disabled={pending}
          className="mt-1.5 py-2.5 rounded-md border border-[var(--brass)] text-[var(--brass)] text-[13px] font-semibold disabled:opacity-45 hover:bg-[var(--brass)]/10 transition-colors"
        >
          {pending ? (isLogin ? "Signing in…" : "Creating account…") : isLogin ? "Sign in" : "Create account"}
        </button>

        {!isLogin && (
          <p className="text-[11px] text-[var(--muted)] text-center leading-relaxed">
            By creating an account you agree to the{" "}
            <Link href="/terms" className="text-[var(--brass)] no-underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[var(--brass)] no-underline">
              Privacy Policy
            </Link>
            .
          </p>
        )}
      </form>

      <div className="text-center mt-5 text-xs text-[var(--muted)]">
        {isLogin ? (
          <>
            No account?{" "}
            <Link href="/signup" className="text-[var(--brass)] no-underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-[var(--brass)] no-underline">
              Sign in
            </Link>
          </>
        )}
      </div>
    </>
  );
}
