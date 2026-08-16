import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — DevAtlas",
};

export default function PrivacyPage() {
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
            with real policy content (and get it reviewed) before relying on it.
          </p>
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-medium mb-2">
          Privacy Policy
        </h1>
        <p className="text-xs text-[var(--muted)] font-[family-name:var(--font-mono)] mb-8">
          Last updated: [DATE]
        </p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--text)]">
          <section>
            <h2 className="text-base font-semibold mb-2">What we collect</h2>
            <p className="text-[var(--muted)]">
              [DESCRIBE: account details (name, email) collected at signup;
              content you create in the app (e.g. prompts); basic usage data.
              List anything else DevAtlas actually stores.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">How we use it</h2>
            <p className="text-[var(--muted)]">
              [DESCRIBE: to operate your account, show your content back to
              you, and — if applicable — send transactional email like
              signup confirmation and password resets.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Third parties</h2>
            <p className="text-[var(--muted)]">
              [LIST: e.g. Supabase (hosting, auth, database), and your email
              provider once custom SMTP is configured. Note that OAuth
              sign-in, if enabled, shares basic profile info from the
              provider you choose.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Your rights</h2>
            <p className="text-[var(--muted)]">
              [DESCRIBE: how a user can access, export, or delete their
              account and data, and who to contact to do so.]
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
