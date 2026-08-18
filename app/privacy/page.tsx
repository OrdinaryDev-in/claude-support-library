import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/layout/Logo";

// Plain "Privacy Policy" — see app/terms/page.tsx's comment on why this
// isn't the full "... — DevAtlas" string now that a title.template exists.
export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How DevAtlas collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--ink)] text-[var(--text)] px-4 py-12 sm:py-16">
      <div className="max-w-[640px] mx-auto">
        <Link href="/" className="inline-block no-underline">
          <Logo markSize={24} textClassName="text-xl" />
        </Link>

        <div className="mt-8 mb-10 p-4 border border-[var(--brass)]/40 rounded-md bg-[var(--brass)]/5">
          <p className="text-[13px] text-[var(--muted)] leading-relaxed m-0">
            <strong className="text-[var(--brass)]">Draft, not reviewed by a lawyer.</strong>{" "}
            This describes what DevAtlas actually does today, in plain
            language — it hasn&apos;t had legal review. Get it reviewed before
            treating it as a binding policy, and update it if what the app
            collects or does changes.
          </p>
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-medium mb-2">
          Privacy Policy
        </h1>
        <p className="text-xs text-[var(--muted)] font-[family-name:var(--font-mono)] mb-8">
          Last updated: August 16, 2026
        </p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-[var(--text)]">
          <section>
            <h2 className="text-base font-semibold mb-2">Who this covers</h2>
            <p className="text-[var(--muted)]">
              DevAtlas is operated by Mubashir Mohamed. This policy explains
              what information DevAtlas collects when you use it, why, and
              what your options are.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">What we collect</h2>
            <p className="text-[var(--muted)]">
              At sign-up: your email address and, optionally, your full
              name. Your password is never stored in plain text — it&apos;s
              handled and hashed by our authentication provider, Supabase.
            </p>
            <p className="text-[var(--muted)] mt-3">
              As you use the app: the prompts you create (title,
              description, category, tags, and the template text itself),
              and basic account metadata like your last sign-in time and
              account role.
            </p>
            <p className="text-[var(--muted)] mt-3">
              We don&apos;t run analytics or advertising trackers, and we don&apos;t
              collect anything beyond what&apos;s described above.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">How we use it</h2>
            <p className="text-[var(--muted)]">
              To create and authenticate your account, and to show your
              prompts to you. Prompts you mark as published are visible to
              other signed-in DevAtlas users in the shared library — that&apos;s
              the point of the app, so treat anything you publish as shared,
              not private.
            </p>
            <p className="text-[var(--muted)] mt-3">
              We send transactional email only: sign-up confirmation and
              password-reset messages. No marketing email.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Cookies</h2>
            <p className="text-[var(--muted)]">
              DevAtlas sets one essential cookie (via Supabase Auth) to keep
              you signed in. It&apos;s required for the app to work and isn&apos;t
              used for tracking, advertising, or analytics.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Third parties</h2>
            <p className="text-[var(--muted)]">
              <strong className="text-[var(--text)]">Supabase</strong>{" "}
              (supabase.com) hosts our database, authentication, and email
              delivery — your account and content data lives on their
              infrastructure. We don&apos;t sell or share your data with
              advertisers or data brokers, and we don&apos;t use any other
              third-party service today.
            </p>
            <p className="text-[var(--muted)] mt-3">
              If Google or GitHub sign-in is enabled in the future, choosing
              one would share basic profile info (name, email) from that
              provider with us to create your account — this policy will be
              updated first.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Your options</h2>
            <p className="text-[var(--muted)]">
              You can update your display name from{" "}
              <Link href="/account" className="text-[var(--brass)] no-underline">
                Account settings
              </Link>{" "}
              at any time. There&apos;s no self-serve account deletion or data
              export yet — email us (below) and we&apos;ll handle it directly.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Data retention</h2>
            <p className="text-[var(--muted)]">
              We keep your account and content for as long as your account
              is active. If you ask us to delete your account, we&apos;ll remove
              your personal data and content within a reasonable time,
              except where we&apos;re required to keep records for legal
              reasons.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Children</h2>
            <p className="text-[var(--muted)]">
              DevAtlas isn&apos;t directed at children, and we don&apos;t knowingly
              collect information from anyone under 13.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Changes to this policy</h2>
            <p className="text-[var(--muted)]">
              If what DevAtlas collects or how it&apos;s used changes materially,
              we&apos;ll update this page and change the date above.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">Contact</h2>
            <p className="text-[var(--muted)]">
              Questions about this policy, or a data request:{" "}
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
