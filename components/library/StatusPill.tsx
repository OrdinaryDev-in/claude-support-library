import type { StatusMeta } from "@/lib/constants/review";

/** Shown to a resource's author/admin when it isn't (yet) publicly
 * visible — approved rows never render this on the public grid, since
 * everyone else never sees a non-approved row in the first place (RLS).
 * Generic over resource type — the caller resolves `status` to its own
 * meta map (PROMPT_STATUS_META / SKILL_STATUS_META, lib/constants/review.ts)
 * since Prompts and Skills each have their own status enum, even though
 * the three values happen to match today. */
export function StatusPill({ meta }: { meta: StatusMeta }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide px-2 py-0.5 border rounded shrink-0"
      style={{ color: meta.color, borderColor: meta.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
