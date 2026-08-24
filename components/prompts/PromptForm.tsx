"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { promptSchema, assembleTemplate, type PromptFormValues } from "@/lib/validation/prompt-schema";
import { createPrompt, updatePrompt } from "@/app/actions/prompts";
import { createCategory } from "@/app/actions/categories";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { CategoryRow } from "@/lib/data/categories";
import type { PromptStatus } from "@/lib/types/database.types";

export interface PromptFormInitialValues extends PromptFormValues {
  id: string;
  slug: string;
  /** The prompt's status *before* this edit — used only to decide whether
   * saving will resubmit it for review (see guard_prompt_review_state(),
   * 20260816090111_prompt_review_workflow.sql: editing an approved/rejected prompt's
   * content always flips it back to pending_review, so this is knowable
   * up front without a round trip). */
  status: PromptStatus;
  /** Is the *editor* (not necessarily the author) an admin? guard_prompt_review_state()'s
   * resubmit-on-edit reset only applies in its non-admin branch — an admin
   * editing an approved/rejected prompt's content leaves status untouched.
   * Needed so the "will resubmit for review" warning isn't shown to an
   * admin editor, for whom it isn't true. */
  editorIsAdmin: boolean;
}

export function PromptForm({
  mode,
  initialValues,
  categories,
  isAdmin = false,
}: {
  mode: "create" | "edit";
  initialValues?: PromptFormInitialValues;
  /** Live rows from the `categories` table (resource_type: "prompt"). */
  categories: CategoryRow[];
  /** Gates the inline "+ New category" control below — categories are
   * admin-managed (unlike tags, which any signed-in user can add), same
   * reasoning as app/actions/categories.ts's requireAdmin(). */
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";

  // Only id/key/label/color are ever rendered here, so the locally-appended
  // "+ New category" entry doesn't need to fake the rest of CategoryRow.
  const [categoryList, setCategoryList] = useState<Pick<CategoryRow, "id" | "key" | "label" | "color">[]>(categories);
  const [fields, setFields] = useState<PromptFormValues>(
    initialValues ?? {
      title: "",
      description: "",
      category_id: categories[0]?.id ?? "",
      tagsInput: "",
      base_instructions: "",
      fill_in_details_guidance: "",
      reference_projects_guidance: "",
      reference_links_guidance: "",
      expected_output_notes: "",
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryKey, setNewCategoryKey] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#5b8def");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  async function handleAddCategory() {
    setCategoryError(null);
    setCreatingCategory(true);
    const result = await createCategory({
      resource_type: "prompt",
      key: newCategoryKey,
      label: newCategoryLabel,
      color: newCategoryColor,
      sort_order: categoryList.length,
    });
    setCreatingCategory(false);
    if (!result.ok) {
      setCategoryError(result.error);
      return;
    }
    setCategoryList((list) => [...list, result.category]);
    setField("category_id", result.category.id);
    setAddingCategory(false);
    setNewCategoryKey("");
    setNewCategoryLabel("");
  }

  function setField<K extends keyof PromptFormValues>(key: K, value: PromptFormValues[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  const preview = useMemo(() => assembleTemplate(fields), [fields]);

  // Editing an approved/rejected prompt's content resubmits it for review
  // (guard_prompt_review_state(), 20260816090111_prompt_review_workflow.sql) — but
  // only in that trigger's non-admin branch; an admin editor's save never
  // resets status. Both are known from data the page already loaded, no
  // need to wait for the save to complete.
  const priorStatus = isEdit ? initialValues?.status : undefined;
  const willResubmit =
    priorStatus !== undefined && priorStatus !== "pending_review" && !initialValues?.editorIsAdmin;
  const toastText = !isEdit ? "Submitted for review" : willResubmit ? "Saved — resubmitted for review" : "Saved";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = promptSchema.safeParse(fields);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setError(null);
    setSaving(true);

    const result =
      isEdit && initialValues
        ? await updatePrompt(initialValues.id, parsed.data)
        : await createPrompt(parsed.data);

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSavedToast(true);
    setTimeout(() => {
      router.push(`/library/prompts/${result.slug}`);
      router.refresh();
    }, 500);
  }

  const cancelHref = isEdit && initialValues ? `/library/prompts/${initialValues.slug}` : "/library/prompts";
  const labelClass =
    "block font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-[var(--muted)] uppercase mb-1.5";

  return (
    <div className="flex-1 w-full mx-auto max-w-[1180px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
      <div className="text-xs text-[var(--muted)] mb-4">
        <Link href="/library/prompts" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
          Prompts
        </Link>{" "}
        / {isEdit ? "Edit" : "New"}
      </div>
      <h1 className="font-[family-name:var(--font-display)] font-medium text-2xl sm:text-[28px] mb-3">
        {isEdit ? "Edit prompt" : "New prompt"}
      </h1>
      {!isEdit && (
        <p className="text-[13px] text-[var(--muted)] mb-6 sm:mb-8 max-w-[560px]">
          New prompts go to an admin for review before they appear in the library.
        </p>
      )}
      {willResubmit && (
        <p className="text-[13px] text-[var(--brass)] mb-6 sm:mb-8 max-w-[560px]">
          {priorStatus === "approved"
            ? "This prompt is currently live. Saving changes will pull it from the library and resubmit it for review."
            : "Saving changes will resubmit this prompt for review."}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1 w-full lg:max-w-[560px]">
          <div>
            <label htmlFor="prompt-title" className={labelClass}>
              Title
            </label>
            <input
              id="prompt-title"
              className="dv-input"
              value={fields.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Add Rate Limiting to an Existing API"
            />
          </div>
          <div>
            <label htmlFor="prompt-description" className={labelClass}>
              Description
            </label>
            <input
              id="prompt-description"
              className="dv-input"
              value={fields.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="One sentence — what this prompt gets you"
            />
          </div>
          <div>
            <span id="prompt-category-label" className={labelClass}>
              Category
            </span>
            <div role="radiogroup" aria-labelledby="prompt-category-label" className="flex flex-wrap gap-2">
              {categoryList.map((c) => {
                const active = fields.category_id === c.id;
                return (
                  <button
                    type="button"
                    key={c.id}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setField("category_id", c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs"
                    style={{
                      borderColor: active ? c.color : "var(--border)",
                      background: active ? "var(--surface-2)" : "transparent",
                      color: "var(--text)",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                    {c.label}
                  </button>
                );
              })}
              {isAdmin && !addingCategory && (
                <button
                  type="button"
                  onClick={() => setAddingCategory(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-[var(--border)] text-xs text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--text)]"
                >
                  + New category
                </button>
              )}
            </div>
            {isAdmin && addingCategory && (
              <div className="flex flex-wrap items-end gap-2 mt-2.5 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-md">
                <div>
                  <label htmlFor="new-cat-key" className="block text-[11px] text-[var(--muted)] mb-1">
                    Key
                  </label>
                  <input
                    id="new-cat-key"
                    className="dv-input w-32"
                    placeholder="data_analysis"
                    value={newCategoryKey}
                    onChange={(e) => setNewCategoryKey(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="new-cat-label" className="block text-[11px] text-[var(--muted)] mb-1">
                    Label
                  </label>
                  <input
                    id="new-cat-label"
                    className="dv-input w-40"
                    placeholder="Data Analysis"
                    value={newCategoryLabel}
                    onChange={(e) => setNewCategoryLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="new-cat-color" className="block text-[11px] text-[var(--muted)] mb-1">
                    Color
                  </label>
                  <input
                    id="new-cat-color"
                    type="color"
                    className="h-[34px] w-[42px] rounded-md border border-[var(--border)] bg-transparent p-1"
                    value={newCategoryColor}
                    onChange={(e) => setNewCategoryColor(e.target.value)}
                  />
                </div>
                <LoadingButton
                  type="button"
                  onClick={handleAddCategory}
                  pending={creatingCategory}
                  pendingLabel="Adding…"
                  className="px-3 py-2 rounded-md border border-[var(--brass)] text-[var(--brass)] text-[13px] font-semibold"
                >
                  Add
                </LoadingButton>
                <button
                  type="button"
                  onClick={() => setAddingCategory(false)}
                  className="px-3 py-2 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px]"
                >
                  Cancel
                </button>
                {categoryError && (
                  <p role="alert" className="text-xs text-[var(--danger)] basis-full">
                    {categoryError}
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="prompt-tags" className={labelClass}>
              Tags <span className="normal-case font-[family-name:var(--font-body)] text-[var(--muted)]">(comma-separated)</span>
            </label>
            <input
              id="prompt-tags"
              className="dv-input"
              value={fields.tagsInput}
              onChange={(e) => setField("tagsInput", e.target.value)}
              placeholder="api, postgres, auth"
            />
          </div>

          <div className="h-px bg-[var(--border)] my-1" />

          <div>
            <label htmlFor="prompt-base-instructions" className={labelClass}>
              Task Framing
            </label>
            <textarea
              id="prompt-base-instructions"
              className="dv-input resize-y"
              rows={3}
              value={fields.base_instructions}
              onChange={(e) => setField("base_instructions", e.target.value)}
              placeholder="AI role and task-type framing"
            />
          </div>
          <div>
            <label htmlFor="prompt-fill-in-details" className={labelClass}>
              Fill In Your Details
            </label>
            <textarea
              id="prompt-fill-in-details"
              className="dv-input resize-y"
              style={{ fontFamily: "var(--font-mono)" }}
              rows={3}
              value={fields.fill_in_details_guidance}
              onChange={(e) => setField("fill_in_details_guidance", e.target.value)}
              placeholder="[BRACKETED PLACEHOLDERS]"
            />
          </div>
          <div>
            <label htmlFor="prompt-reference-projects" className={labelClass}>
              Similar Reference Projects
            </label>
            <textarea
              id="prompt-reference-projects"
              className="dv-input resize-y"
              style={{ fontFamily: "var(--font-mono)" }}
              rows={2}
              value={fields.reference_projects_guidance}
              onChange={(e) => setField("reference_projects_guidance", e.target.value)}
              placeholder="[LINKS/DESCRIPTIONS OF PRIOR WORK]"
            />
          </div>
          <div>
            <label htmlFor="prompt-reference-links" className={labelClass}>
              Reference Links / Docs
            </label>
            <textarea
              id="prompt-reference-links"
              className="dv-input resize-y"
              style={{ fontFamily: "var(--font-mono)" }}
              rows={2}
              value={fields.reference_links_guidance}
              onChange={(e) => setField("reference_links_guidance", e.target.value)}
              placeholder="[CLOUD/DOCS LINKS]"
            />
          </div>
          <div>
            <label htmlFor="prompt-expected-output" className={labelClass}>
              Expected Output
            </label>
            <textarea
              id="prompt-expected-output"
              className="dv-input resize-y"
              rows={3}
              value={fields.expected_output_notes}
              onChange={(e) => setField("expected_output_notes", e.target.value)}
              placeholder="What a correct AI response must include"
            />
          </div>

          {error && (
            <div role="alert" className="text-xs text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="flex gap-2.5 mt-2">
            <LoadingButton
              type="submit"
              pending={saving}
              pendingLabel="Saving…"
              className="px-[18px] py-2.5 rounded-md border-none text-[13px] font-semibold cursor-pointer bg-[var(--brass)] text-[var(--ink)] disabled:bg-[var(--surface-2)] disabled:text-[var(--muted)]"
            >
              {isEdit ? "Save changes" : "Publish prompt"}
            </LoadingButton>
            <Link
              href={cancelHref}
              className="no-underline px-4 py-2.5 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px]"
            >
              Cancel
            </Link>
          </div>
        </form>

        <div className="flex-1 w-full min-w-0">
          <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-[var(--muted)] uppercase mb-2.5">
            Copy-paste preview
          </div>
          <div
            className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 text-xs leading-relaxed text-[var(--text)] whitespace-pre-wrap lg:sticky lg:top-20 max-h-[70vh] overflow-auto"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {preview}
          </div>
        </div>
      </div>

      {savedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-7 left-1/2 -translate-x-1/2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-[18px] py-3 z-[60] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        >
          <span className="text-[13px] font-semibold text-[var(--teal)]">{toastText}</span>
        </div>
      )}
    </div>
  );
}
