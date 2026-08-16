"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approvePrompt, rejectPrompt } from "@/app/actions/review";
import { categoryMeta } from "@/lib/constants/categories/prompts";
import type { ReviewQueueRow } from "@/lib/data/prompts";
import type { PromptStatus } from "@/lib/types/database.types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ReviewQueueTable({ rows, status }: { rows: ReviewQueueRow[]; status: PromptStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleApprove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await approvePrompt(id);
      setBusyId(null);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function openReject(id: string) {
    setRejectingId(id);
    setReason("");
    setError(null);
  }

  function submitReject() {
    if (!rejectingId) return;
    const id = rejectingId;
    setBusyId(id);
    startTransition(async () => {
      const result = await rejectPrompt(id, reason);
      setBusyId(null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRejectingId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const cat = categoryMeta(row.category);
        return (
          <div
            key={row.id}
            className="flex flex-col sm:flex-row sm:items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color }} />
                <span
                  className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide"
                  style={{ color: cat.color }}
                >
                  {cat.label}
                </span>
              </div>
              <Link
                href={`/admin/review/${row.slug}`}
                className="text-[15px] font-semibold text-[var(--text)] no-underline hover:underline"
              >
                {row.title}
              </Link>
              <div className="text-[13px] text-[var(--muted)] mt-0.5 truncate">
                {row.author?.full_name || row.author?.email || "Unknown author"} ·{" "}
                {status === "pending_review"
                  ? `submitted ${formatDate(row.created_at)}`
                  : `reviewed ${row.reviewed_at ? formatDate(row.reviewed_at) : "—"}`}
              </div>
              {status === "rejected" && row.rejection_reason && (
                <div className="text-[13px] text-[var(--danger)] mt-1.5">&ldquo;{row.rejection_reason}&rdquo;</div>
              )}
            </div>

            {status === "pending_review" && (
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleApprove(row.id)}
                  disabled={pending && busyId === row.id}
                  className="px-3.5 py-2 rounded-md border border-[var(--teal)] text-[var(--teal)] text-[13px] font-semibold disabled:opacity-45"
                >
                  Approve
                </button>
                <button
                  onClick={() => openReject(row.id)}
                  disabled={pending && busyId === row.id}
                  className="px-3.5 py-2 rounded-md border border-[var(--danger)] text-[var(--danger)] text-[13px] font-semibold disabled:opacity-45"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}

      {rejectingId && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] p-7 w-full max-w-[420px]">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-medium mb-2.5">
              Reject this prompt?
            </h2>
            <p className="text-[13px] text-[var(--muted)] mb-3 leading-relaxed">
              The author will see this reason on their submission.
            </p>
            <textarea
              className="dv-input mb-2"
              rows={3}
              placeholder="e.g. Overlaps with an existing prompt, or the template needs more detail."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {error && <div className="text-xs text-[var(--danger)] mb-2">{error}</div>}
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setRejectingId(null)}
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
