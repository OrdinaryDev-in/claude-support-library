// Brand mark for DevAtlas. Inlined (rather than <img src="/logo-mark.svg">)
// so it costs no extra request and its colors track the design tokens in
// app/globals.css (`--ink` and `--brass` are the same values baked into the
// source asset at public/logo-mark.svg / public/logo.svg).
export function LogoMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 192 192"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="DevAtlas"
    >
      <rect x="0" y="0" width="192" height="192" rx="40" fill="oklch(12% 0.006 240)" />
      <circle cx="96" cy="46" r="10" fill="oklch(72% 0.13 200)" />
      <circle cx="146" cy="96" r="10" fill="oklch(72% 0.13 200)" />
      <circle cx="96" cy="146" r="10" fill="oklch(72% 0.13 200)" />
      <circle cx="46" cy="96" r="10" fill="oklch(72% 0.13 200)" />
      <line x1="96" y1="96" x2="96" y2="46" stroke="oklch(72% 0.13 200)" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
      <line x1="96" y1="96" x2="146" y2="96" stroke="oklch(72% 0.13 200)" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
      <line x1="96" y1="96" x2="96" y2="146" stroke="oklch(72% 0.13 200)" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
      <line x1="96" y1="96" x2="46" y2="96" stroke="oklch(72% 0.13 200)" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
      <circle cx="96" cy="96" r="14" fill="oklch(12% 0.006 240)" />
      <circle cx="96" cy="96" r="12" fill="oklch(72% 0.13 80)" />
    </svg>
  );
}

// Mark + wordmark, set in the site's own display font rather than the source
// asset's baked-in Sora text — keeps it visually consistent with every other
// heading on the site, and doesn't depend on Sora being loaded.
export function Logo({
  markSize = 26,
  textClassName = "text-xl",
  className = "",
}: {
  markSize?: number;
  textClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={markSize} />
      <span
        className={`font-[family-name:var(--font-display)] font-semibold text-[var(--text)] ${textClassName}`}
      >
        DevAtlas
      </span>
    </span>
  );
}
