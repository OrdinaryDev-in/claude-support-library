"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categoryMeta } from "@/lib/constants/categories/prompts";
import { approvePrompt, rejectPrompt } from "@/app/actions/review";
import { StatusPill } from "@/components/prompts/StatusPill";
import type { ReviewQueueRow } from "@/lib/data/prompts";

interface SectionMeta {
  key: keyof Pick<
    ReviewQueueRow,
    | "base_instructions"
    | "fill_in_details_guidance"
    | "reference_projects_guidance"
    | "reference_links_guidance"
    | "expected_output_notes"
  >;
  label: string;
  accent?: boolean;
  mono?: boolean;
}

const SECTIONS: SectionMeta[] = [
  { key: "base_instructions", label: "Task Framing", accent: true },
  { key: "fill_in_details_guidance", label: "Fill In Your Details", mono: true },
  { key: "reference_projects_guidance", label: "Similar Reference Projects", mono: true },
  { key: "reference_links_guidance", label: "Reference Links / Docs", mono: true },
  { key: "expected_output_notes", label: "Expected Output" },
];

/** The review-queue counterpart to components/prompts/PromptDetail.tsx —
 * same section layout so an admin reviews exactly what a copy-paste would
 * look like, with an approve/reject action bar instead of edit/delete. */
export function ReviewDetail({ prompt }: { prompt: ReviewQueueRow }) {
  const router = useRouter();
  const cat = categoryMeta(prompt.category);

  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approvePrompt(prompt.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/review");
      router.refresh();
    });
  }

  // Same Escape-to-close reasoning as ReviewQueueTable's reject dialog.
  useEffect(() => {
    if (!rejecting) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setRejecting(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rejecting]);

  function submitReject() {
    startTransition(async () => {
      const result = await rejectPrompt(prompt.id, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/review?status=rejected");
      router.refresh();
    });
  }

  return (
    <div className="flex-1 w-full mx-auto max-w-[900px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
      <div className="text-xs text-[var(--muted)] mb-4">
        <Link href="/admin/review" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
          Review queue
        </Link>{" "}
        / {prompt.title}
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 sm:gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
            <span
              className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide"
              style={{ color: cat.color }}
            >
              {cat.label}
            </span>
            <StatusPill status={prompt.status} />
          </div>
          <h1 className="font-[family-name:var(--font-display)] font-medium text-[26px] sm:text-[32px] mb-2.5 max-w-[640px]">
            {prompt.title}
          </h1>
          <p className="text-sm text-[var(--muted)] max-w-[600px] mb-2 leading-relaxed">{prompt.description}</p>
          <p className="text-[13px] text-[var(--muted)]">
            Submitted by {prompt.author?.full_name || prompt.author?.email || "Unknown author"}
          </p>
          {prompt.status === "rejected" && prompt.rejection_reason && (
            <p className="text-[13px] text-[var(--danger)] mt-2 max-w-[600px]">
              &ldquo;{prompt.rejection_reason}&rdquo;
            </p>
          )}
        </div>

        {prompt.status === "pending_review" && (
          <div className="flex flex-wrap gap-2 shrink-0 sm:sticky sm:top-20">
            <button
              onClick={handleApprove}
              disabled={pending}
              className="px-3.5 py-2 rounded-md border border-[var(--teal)] text-[var(--teal)] text-[13px] font-semibold disabled:opacity-45"
            >
              Approve
            </button>
            <button
              onClick={() => setRejecting(true)}
              disabled={pending}
              className="px-3.5 py-2 rounded-md border border-[var(--danger)] text-[var(--danger)] text-[13px] font-semibold disabled:opacity-45"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="text-xs text-[var(--danger)] mt-4">
          {error}
        </div>
      )}

      <div className="h-px bg-[var(--border)] my-6 sm:my-8" />

      <div className="flex flex-col gap-5 max-w-[760px]">
        {SECTIONS.map((section) => (
          <div
            key={section.key}
            className="pl-4"
            style={{ borderLeft: `2px solid ${section.accent ? "var(--brass)" : "var(--border)"}` }}
          >
            <div
              className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide uppercase mb-2"
              style={{ color: section.accent ? "var(--brass)" : "var(--muted)" }}
            >
              {section.label}
            </div>
            <p
              className="text-sm leading-relaxed text-[var(--text)] m-0 whitespace-pre-wrap"
              style={section.mono ? { fontFamily: "var(--font-mono)" } : undefined}
            >
              {prompt[section.key]}
            </p>
          </div>
        ))}
      </div>

      {rejecting && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-reject-heading"
            className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] p-7 w-full max-w-[420px]"
          >
            <h2
              id="review-reject-heading"
              className="font-[family-name:var(--font-display)] text-lg font-medium mb-2.5"
            >
              Reject this prompt?
            </h2>
            <p className="text-[13px] text-[var(--muted)] mb-3 leading-relaxed">
              The author will see this reason on their submission.
            </p>
            <label htmlFor="review-reject-reason" className="sr-only">
              Rejection reason
            </label>
            <textarea
              id="review-reject-reason"
              className="dv-input mb-2"
              rows={3}
              placeholder="e.g. Overlaps with an existing prompt, or the template needs more detail."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setRejecting(false)}
                className="px-3.5 py-2 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px]"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={pending}
                className="px-3.5 py-2 rounded-md border-none bg-[var(--danger)] text-[var(--ink)] text-[13px] font-semibold disabled:opacity-45"
              >
                {pending ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
