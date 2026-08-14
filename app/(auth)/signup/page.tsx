import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)] text-[var(--text)] px-4 py-10">
      <div className="w-full max-w-[380px] bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-7 sm:p-9">
        <div className="text-center mb-7">
          <div className="font-[family-name:var(--font-display)] text-2xl font-semibold">
            DevAtlas
          </div>
          <div className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)] tracking-wider mt-1">
            CREATE YOUR ACCOUNT
          </div>
        </div>
        <Suspense>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </div>
  );
}
