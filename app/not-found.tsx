import Link from "next/link";

// Root-level fallback for both an unmatched URL and any explicit
// notFound() call (e.g. app/(app)/library/prompts/[slug]/page.tsx,
// app/(app)/admin/review/page.tsx) that doesn't have a more specific
// not-found.tsx in its own segment — Next walks up to this one. Still
// renders nested inside app/(app)/layout.tsx's NavBar for any route under
// that group, since a not-found boundary only replaces the matched
// segment's content, not its ancestor layouts.
export default function NotFound() {
  return (
    <div className="flex-1 w-full mx-auto max-w-[640px] px-4 sm:px-8 py-24 text-center">
      <div className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--brass)] tracking-wider uppercase mb-3">
        § 404
      </div>
      <h1 className="font-[family-name:var(--font-display)] font-medium text-3xl sm:text-[36px] mb-3">
        Page not found
      </h1>
      <p className="text-sm text-[var(--muted)] leading-relaxed mb-8">
        This page doesn&apos;t exist, or you don&apos;t have access to it.
      </p>
      <Link
        href="/library"
        className="inline-block no-underline px-4 py-2 border border-[var(--brass)] text-[var(--brass)] rounded-md text-[13px] font-semibold hover:bg-[var(--brass)]/10 transition-colors"
      >
        Back to the library
      </Link>
    </div>
  );
}
