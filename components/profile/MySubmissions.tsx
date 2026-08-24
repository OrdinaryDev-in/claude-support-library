import Link from "next/link";
import { categoryDisplay } from "@/lib/data/categories";
import { StatusPill } from "@/components/prompts/StatusPill";
import type { PromptWithCategory } from "@/lib/data/prompts";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** The one place an author can see their own pending/rejected prompts —
 * the public Browse grid only ever shows approved prompts (search_prompts
 * RPC, 20260816090111_prompt_review_workflow.sql), so this is where "did my
 * submission go anywhere?" gets answered. */
export function MySubmissions({ submissions }: { submissions: PromptWithCategory[] }) {
  if (submissions.length === 0) {
    return (
      <div className="text-center py-10 px-5 border border-dashed border-[var(--border)] rounded-lg">
        <div className="text-[13px] text-[var(--muted)]">You haven&apos;t submitted any prompts yet.</div>
      </div>
    );
  }

  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
      {submissions.map((prompt) => {
        const cat = categoryDisplay(prompt.categories);
        return (
          <li key={prompt.id}>
            <Link
              href={`/library/prompts/${prompt.slug}`}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 no-underline text-inherit bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 hover:border-[color-mix(in_srgb,var(--brass)_40%,transparent)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color }} />
                  <span
                    className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide"
                    style={{ color: cat.color }}
                  >
                    {cat.label}
                  </span>
                  <StatusPill status={prompt.status} />
                </div>
                <div className="text-[15px] font-semibold text-[var(--text)] truncate">{prompt.title}</div>
                <div className="text-[13px] text-[var(--muted)] mt-0.5">
                  Submitted {formatDate(prompt.created_at)}
                </div>
                {prompt.status === "rejected" && prompt.rejection_reason && (
                  <div className="text-[13px] text-[var(--danger)] mt-1.5">&ldquo;{prompt.rejection_reason}&rdquo;</div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
