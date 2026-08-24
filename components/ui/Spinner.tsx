/** Small inline loading spinner. Uses `currentColor` so it automatically
 * matches whatever text color the surrounding button/element already has —
 * no per-call-site color prop needed. Keyframe lives in app/globals.css
 * (`.dv-spin`) alongside the app's other shared animations (shimmer, riseIn);
 * `prefers-reduced-motion` is already handled globally there. */
export function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg
      className="dv-spin shrink-0"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
