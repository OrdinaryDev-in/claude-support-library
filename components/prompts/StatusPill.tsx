import { PROMPT_STATUS_META } from "@/lib/constants/review";
import type { PromptStatus } from "@/lib/types/database.types";

/** Shown to a prompt's author/admin when it isn't (yet) publicly visible —
 * approved prompts never render this on the public grid, since everyone
 * else never sees a non-approved row in the first place (RLS). */
export function StatusPill({ status }: { status: PromptStatus }) {
  const meta = PROMPT_STATUS_META[status];
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
