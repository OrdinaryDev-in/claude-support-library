"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categoryDisplay } from "@/lib/data/categories";
import { approveConnector, rejectConnector } from "@/app/actions/connector-review";
import { StatusPill } from "@/components/library/StatusPill";
import { CONNECTOR_STATUS_META } from "@/lib/constants/review";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { ReviewQueueRow } from "@/lib/data/connectors";

interface SectionMeta {
  key: keyof Pick<ReviewQueueRow, "setup_steps" | "config_snippet" | "gotchas_notes" | "docs_links">;
  label: string;
  accent?: boolean;
  mono?: boolean;
}

const SECTIONS: SectionMeta[] = [
  { key: "setup_steps", label: "Setup Steps", accent: true },
  { key: "config_snippet", label: "Config Snippet", mono: true },
  { key: "gotchas_notes", label: "Gotchas / Notes" },
  { key: "docs_links", label: "Docs Links", mono: true },
];

/** The Connectors counterpart to components/admin/ReviewDetail.tsx. */
export function ConnectorReviewDetail({ connector }: { connector: ReviewQueueRow }) {
  const router = useRouter();
  const cat = categoryDisplay(connector.categories);

  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveConnector(connector.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/review/connectors");
      router.refresh();
    });
  }

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
      const result = await rejectConnector(connector.id, reason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/review/connectors?status=rejected");
      router.refresh();
    });
  }

  return (
    <div className="flex-1 w-full mx-auto max-w-[900px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
      <div className="text-xs text-[var(--muted)] mb-4">
        <Link href="/admin/review/connectors" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
          Review queue
        </Link>{" "}
        / {connector.title}
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
            <StatusPill meta={CONNECTOR_STATUS_META[connector.status]} />
          </div>
          <h1 className="font-[family-name:var(--font-display)] font-medium text-[26px] sm:text-[32px] mb-2.5 max-w-[640px]">
            {connector.title}
          </h1>
          <p className="text-sm text-[var(--muted)] max-w-[600px] mb-2 leading-relaxed">{connector.description}</p>
          <p className="text-[13px] text-[var(--muted)]">
            Submitted by {connector.author?.full_name || connector.author?.email || "Unknown author"}
          </p>
          {connector.status === "rejected" && connector.rejection_reason && (
            <p className="text-[13px] text-[var(--danger)] mt-2 max-w-[600px]">
              &ldquo;{connector.rejection_reason}&rdquo;
            </p>
          )}
        </div>

        {connector.status === "pending_review" && (
          <div className="flex flex-wrap gap-2 shrink-0 sm:sticky sm:top-20">
            <LoadingButton
              onClick={handleApprove}
              pending={pending}
              pendingLabel="Approving…"
              className="px-3.5 py-2 rounded-md border border-[var(--teal)] text-[var(--teal)] text-[13px] font-semibold"
            >
              Approve
            </LoadingButton>
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
              {connector[section.key]}
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
            <h2 id="review-reject-heading" className="font-[family-name:var(--font-display)] text-lg font-medium mb-2.5">
              Reject this connector?
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
              placeholder="e.g. Overlaps with an existing connector, or the setup steps need more detail."
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
              <LoadingButton
                onClick={submitReject}
                pending={pending}
                pendingLabel="Rejecting…"
                className="px-3.5 py-2 rounded-md border-none bg-[var(--danger)] text-[var(--ink)] text-[13px] font-semibold"
              >
                Reject
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
