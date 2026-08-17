import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { Logo } from "@/components/layout/Logo";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)] text-[var(--text)] relative px-4 py-10">
      <div
        className="absolute inset-x-0 h-px pointer-events-none hidden sm:block"
        style={{ top: 120, borderTop: "2px dotted rgba(232,163,61,0.2)" }}
      />
      <div className="relative z-10 w-full max-w-[380px] bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-7 sm:p-9">
        <div className="text-center mb-7">
          <Logo markSize={30} textClassName="text-2xl" className="justify-center" />
          <div className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)] tracking-wider mt-1">
            SIGN IN TO THE LIBRARY
          </div>
        </div>
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  );
}
