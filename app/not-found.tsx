export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)] text-[var(--text)] px-4 py-10">
      <div className="w-full max-w-[380px] bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-7 sm:p-9 text-center">
        <div className="font-[family-name:var(--font-display)] text-2xl font-semibold mb-2">
          404
        </div>
        <div className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)] tracking-wider uppercase mb-6">
          Page not found
        </div>
        <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">
          That page doesn&apos;t exist, or it may have moved.
        </p>
        <a
          href="/library"
          className="inline-block py-2.5 px-5 rounded-md border border-[var(--brass)] text-[var(--brass)] text-[13px] font-semibold hover:bg-[var(--brass)]/10 transition-colors"
        >
          Back to the library
        </a>
      </div>
    </div>
  );
}
