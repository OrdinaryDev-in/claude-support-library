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
            <strong className="text-[var(--brass)]">Draft, not reviewed by a lawyer.</strong>{" "}
            This describes what using DevAtlas actually involves today, in
            plain language — it hasn&apos;t had legal review. Get it reviewed
            before treating it as binding. The governing-law section below
            is intentionally left blank pending that.
          </p>
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-medium mb-2">
          Terms of Service
        </h1>
        <p className="text-xs text-[var(--muted)] font-[family-name:var(--font-mono)] mb-8">
          Last updated: August 16, 2026
        </p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--text)]">
          <section>
            <h2 className="text-base font-semibold mb-2">Who this covers</h2>
            <p className="text-[var(--muted)]">
              These terms are between you and Mubashir Mohamed, who
              operates DevAtlas. By creating an account, you agree to them.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Accounts</h2>
            <p className="text-[var(--muted)]">
              You&apos;re responsible for keeping your password secure and for
              activity that happens under your account. Give us accurate
              information when you sign up. If you believe your account has
              been compromised, contact us right away (below).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Acceptable use</h2>
            <p className="text-[var(--muted)]">
              Don&apos;t post illegal, infringing, or malicious content; don&apos;t
              attempt to bypass access controls or abuse the service (for
              example, scraping the library at volume or attempting to
              access another user&apos;s account or data); don&apos;t use DevAtlas
              to attack or disrupt other systems.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Your content</h2>
            <p className="text-[var(--muted)]">
              You own the prompts you write. By publishing a prompt, you
              grant DevAtlas a license to store it and display it to other
              signed-in users in the shared library — that&apos;s the core
              function of the app. You&apos;re responsible for making sure you
              have the right to share whatever you post, and for its
              content.
            </p>
            <p className="text-[var(--muted)] mt-3">
              We can remove content that violates these terms. If you
              delete a prompt or your account, we&apos;ll remove it per the{" "}
              <Link href="/privacy" className="text-[var(--brass)] no-underline">
                Privacy Policy
              </Link>
              &apos;s retention section.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Availability</h2>
            <p className="text-[var(--muted)]">
              DevAtlas is provided as-is, without an uptime guarantee. We&apos;ll
              try to keep it running and your data intact, but we don&apos;t
              promise the service will always be available or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Termination</h2>
            <p className="text-[var(--muted)]">
              You can stop using DevAtlas at any time; email us to request
              account deletion (there&apos;s no self-serve option yet). We may
              suspend or remove an account that violates the acceptable-use
              section above.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Disclaimer &amp; liability</h2>
            <p className="text-[var(--muted)]">
              DevAtlas is provided &quot;as is,&quot; without warranties of any kind.
              To the extent permitted by law, Mubashir Mohamed isn&apos;t liable
              for damages arising from your use of the service. This is a
              standard clause worth having a lawyer confirm is appropriate
              for your situation before relying on it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Governing law</h2>
            <p className="text-[var(--muted)]">
              [NOT YET SET — pick the jurisdiction whose law should govern
              these terms and fill this in before relying on the page.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Changes to these terms</h2>
            <p className="text-[var(--muted)]">
              If these terms change materially, we&apos;ll update this page and
              change the date above.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Contact</h2>
            <p className="text-[var(--muted)]">
              Questions about these terms:{" "}
              <a href="mailto:mubashir585@gmail.com" className="text-[var(--brass)] no-underline">
                mubashir585@gmail.com
              </a>
            </p>
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
