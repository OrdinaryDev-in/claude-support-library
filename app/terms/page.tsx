import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — DevAtlas",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--ink)] text-[var(--text)] px-4 py-12 sm:py-16">
      <div className="max-w-[640px] mx-auto">
        <Link href="/" className="font-[family-name:var(--font-display)] text-xl font-semibold no-underline text-[var(--text)]">
          DevAtlas
        </Link>

        <div className="mt-8 mb-10 p-4 border border-[var(--brass)]/40 rounded-md bg-[var(--brass)]/5">
          <p className="text-[13px] text-[var(--muted)] leading-relaxed m-0">
            <strong className="text-[var(--brass)]">Draft placeholder.</strong>{" "}
            This is generic starter text, not reviewed legal advice. Replace it
            with real terms (and get it reviewed) before relying on it.
          </p>
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-medium mb-2">
          Terms of Service
        </h1>
        <p className="text-xs text-[var(--muted)] font-[family-name:var(--font-mono)] mb-8">
          Last updated: [DATE]
        </p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--text)]">
          <section>
            <h2 className="text-base font-semibold mb-2">Accounts</h2>
            <p className="text-[var(--muted)]">
              [DESCRIBE: users are responsible for their account credentials
              and any content they create; minimum age requirement if any.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Acceptable use</h2>
            <p className="text-[var(--muted)]">
              [DESCRIBE: what content or behavior isn&apos;t allowed on DevAtlas.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Content ownership</h2>
            <p className="text-[var(--muted)]">
              [DESCRIBE: who owns prompts a user creates, and what license,
              if any, DevAtlas needs to display/store it.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Termination</h2>
            <p className="text-[var(--muted)]">
              [DESCRIBE: conditions under which an account may be suspended
              or removed, and how a user can delete their own account.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Disclaimer</h2>
            <p className="text-[var(--muted)]">
              [DESCRIBE: the service is provided &quot;as is,&quot; standard
              liability limitations — have this section reviewed, it&apos;s
              the one most worth getting right.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Contact</h2>
            <p className="text-[var(--muted)]">[YOUR CONTACT EMAIL]</p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-[var(--border)]">
          <Link href="/signup" className="text-[var(--brass)] text-[13px] no-underline">
            ← Back to sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
