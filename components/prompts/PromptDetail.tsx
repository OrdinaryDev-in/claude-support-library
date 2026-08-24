"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { categoryDisplay } from "@/lib/data/categories";
import { CopyButton } from "@/components/prompts/CopyButton";
import { StatusPill } from "@/components/prompts/StatusPill";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { deletePrompt, duplicatePrompt } from "@/app/actions/prompts";
import type { PromptWithTags } from "@/lib/data/prompts";

interface SectionMeta {
  key: keyof Pick<
    PromptWithTags,
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

export function PromptDetail({
  prompt,
  templateText,
  isOwner,
}: {
  prompt: PromptWithTags;
  templateText: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const cat = categoryDisplay(prompt.categories);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function confirmDelete() {
    setShowDeleteConfirm(false);
    setActionError(null);
    setShowToast(true);
    deleteTimer.current = setTimeout(async () => {
      const result = await deletePrompt(prompt.id);
      if (!result.ok) {
        // Delete failed server-side after the undo window already closed —
        // the prompt is still here, so don't navigate away as if it
        // succeeded. Surface the error instead of leaving the user to
        // discover it's still in the library on their own.
        setShowToast(false);
        setActionError(result.error);
        return;
      }
      router.push("/library/prompts");
      router.refresh();
    }, 5000);
  }

  function undoDelete() {
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    setShowToast(false);
  }

  // Dialog gets no library/focus-trap of its own (no 3rd-party dependency
  // here) — Escape-to-close is the one keyboard affordance every native
  // dialog-like widget needs at minimum, so it's hand-rolled instead of
  // skipped.
  useEffect(() => {
    if (!showDeleteConfirm) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowDeleteConfirm(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showDeleteConfirm]);

  async function handleDuplicate() {
    setDuplicating(true);
    setActionError(null);
    const result = await duplicatePrompt(prompt.id);
    if (result.ok) {
      router.push(`/library/prompts/${result.slug}/edit`);
    } else {
      setDuplicating(false);
      setActionError(result.error);
    }
  }

  return (
    <div className="flex-1 w-full mx-auto max-w-[900px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
      <div className="text-xs text-[var(--muted)] mb-4">
        <Link href="/library/prompts" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
          Prompts
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
            {/* Only the author/admin ever sees this — everyone else can only
                reach this page for an approved prompt in the first place
                (RLS: prompts_select_signed_in, 20260816090111_prompt_review_workflow.sql). */}
            {isOwner && prompt.status !== "approved" && <StatusPill status={prompt.status} />}
          </div>
          <h1 className="font-[family-name:var(--font-display)] font-medium text-[26px] sm:text-[32px] mb-2.5 max-w-[640px]">
            {prompt.title}
          </h1>
          <p className="text-sm text-[var(--muted)] max-w-[600px] mb-3 leading-relaxed">
            {prompt.description}
          </p>
          {isOwner && prompt.status === "rejected" && prompt.rejection_reason && (
            <p className="text-[13px] text-[var(--danger)] max-w-[600px] mb-3 leading-relaxed">
              &ldquo;{prompt.rejection_reason}&rdquo;
            </p>
          )}
          {prompt.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {prompt.tags.map((tag) => (
                <span
                  key={tag}
                  className="font-[family-name:var(--font-mono)] text-[11px] px-2 py-0.5 border border-[var(--border)] rounded text-[var(--muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {actionError && (
            <p role="alert" className="text-[13px] text-[var(--danger)] max-w-[600px] mt-3">
              {actionError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 shrink-0 sm:sticky sm:top-20">
          <CopyButton text={templateText} />
          <LoadingButton
            onClick={handleDuplicate}
            pending={duplicating}
            pendingLabel="Duplicating…"
            className="px-3.5 py-2 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px]"
          >
            Duplicate as new prompt
          </LoadingButton>
          {isOwner && (
            <>
              <Link
                href={`/library/prompts/${prompt.slug}/edit`}
                className="no-underline px-3.5 py-2 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px]"
              >
                Edit
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3.5 py-2 rounded-md border border-[var(--border)] text-[var(--danger)] text-[13px]"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="h-px bg-[var(--border)] my-6 sm:my-8" />

      <div className="flex flex-col gap-5 max-w-[760px]">
        {SECTIONS.map((section) => (
          <div
            key={section.key}
            className="pl-4"
            style={{
              borderLeft: `2px solid ${section.accent ? "var(--brass)" : "var(--border)"}`,
            }}
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-heading"
            className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] p-7 w-full max-w-[380px]"
          >
            <h2
              id="delete-confirm-heading"
              className="font-[family-name:var(--font-display)] text-lg font-medium mb-2.5"
            >
              Delete this prompt?
            </h2>
            <p className="text-[13px] text-[var(--muted)] mb-5 leading-relaxed">
              &ldquo;{prompt.title}&rdquo; will be removed from the library. You&apos;ll have 5
              seconds to undo.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-2 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px]"
              >
                Cancel
              </button>
              <button
                autoFocus
                onClick={confirmDelete}
                className="px-3.5 py-2 rounded-md border-none bg-[var(--danger)] text-[var(--ink)] text-[13px] font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-7 left-1/2 -translate-x-1/2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-4 py-3 flex items-center gap-4 z-[60] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        >
          <span className="text-[13px] text-[var(--text)]">Deleted</span>
          <button onClick={undoDelete} className="text-[13px] font-semibold text-[var(--brass)]">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
