"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { connectorSchema, assembleConnectorTemplate, type ConnectorFormValues } from "@/lib/validation/connector-schema";
import { createConnector, updateConnector } from "@/app/actions/connectors";
import { createCategory } from "@/app/actions/categories";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { CategoryRow } from "@/lib/data/categories";
import type { ConnectorStatus } from "@/lib/types/database.types";

/** The Connectors counterpart to components/prompts/PromptForm.tsx /
 * components/skills/SkillForm.tsx — same shape/behavior (including the
 * inline "+ New category" control), field names/labels adapted for
 * Connectors' four guidance sections. */
export interface ConnectorFormInitialValues extends ConnectorFormValues {
  id: string;
  slug: string;
  status: ConnectorStatus;
  editorIsAdmin: boolean;
}

export function ConnectorForm({
  mode,
  initialValues,
  categories,
  isAdmin = false,
}: {
  mode: "create" | "edit";
  initialValues?: ConnectorFormInitialValues;
  categories: CategoryRow[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [categoryList, setCategoryList] = useState<Pick<CategoryRow, "id" | "key" | "label" | "color">[]>(categories);
  const [fields, setFields] = useState<ConnectorFormValues>(
    initialValues ?? {
      title: "",
      description: "",
      category_id: categories[0]?.id ?? "",
      tagsInput: "",
      setup_steps: "",
      config_snippet: "",
      gotchas_notes: "",
      docs_links: "",
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
      resource_type: "connector",
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

  function setField<K extends keyof ConnectorFormValues>(key: K, value: ConnectorFormValues[K]) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  const preview = useMemo(() => assembleConnectorTemplate(fields), [fields]);

  const priorStatus = isEdit ? initialValues?.status : undefined;
  const willResubmit =
    priorStatus !== undefined && priorStatus !== "pending_review" && !initialValues?.editorIsAdmin;
  const toastText = !isEdit ? "Submitted for review" : willResubmit ? "Saved — resubmitted for review" : "Saved";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = connectorSchema.safeParse(fields);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check the form.");
      return;
    }
    setError(null);
    setSaving(true);

    const result =
      isEdit && initialValues
        ? await updateConnector(initialValues.id, parsed.data)
        : await createConnector(parsed.data);

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSavedToast(true);
    setTimeout(() => {
      router.push(`/library/connectors/${result.slug}`);
      router.refresh();
    }, 500);
  }

  const cancelHref = isEdit && initialValues ? `/library/connectors/${initialValues.slug}` : "/library/connectors";
  const labelClass =
    "block font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-[var(--muted)] uppercase mb-1.5";

  return (
    <div className="flex-1 w-full mx-auto max-w-[1180px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
      <div className="text-xs text-[var(--muted)] mb-4">
        <Link href="/library/connectors" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
          Connectors
        </Link>{" "}
        / {isEdit ? "Edit" : "New"}
      </div>
      <h1 className="font-[family-name:var(--font-display)] font-medium text-2xl sm:text-[28px] mb-3">
        {isEdit ? "Edit connector" : "New connector"}
      </h1>
      {!isEdit && (
        <p className="text-[13px] text-[var(--muted)] mb-6 sm:mb-8 max-w-[560px]">
          New connectors go to an admin for review before they appear in the library.
        </p>
      )}
      {willResubmit && (
        <p className="text-[13px] text-[var(--brass)] mb-6 sm:mb-8 max-w-[560px]">
          {priorStatus === "approved"
            ? "This connector is currently live. Saving changes will pull it from the library and resubmit it for review."
            : "Saving changes will resubmit this connector for review."}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1 w-full lg:max-w-[560px]">
          <div>
            <label htmlFor="connector-title" className={labelClass}>
              Title
            </label>
            <input
              id="connector-title"
              className="dv-input"
              value={fields.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Wire Up the GitHub MCP Server"
            />
          </div>
          <div>
            <label htmlFor="connector-description" className={labelClass}>
              Description
            </label>
            <input
              id="connector-description"
              className="dv-input"
              value={fields.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="One sentence — what this connector gets you"
            />
          </div>
          <div>
            <span id="connector-category-label" className={labelClass}>
              Category
            </span>
            <div role="radiogroup" aria-labelledby="connector-category-label" className="flex flex-wrap gap-2">
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
                  <label htmlFor="new-connector-cat-key" className="block text-[11px] text-[var(--muted)] mb-1">
                    Key
                  </label>
                  <input
                    id="new-connector-cat-key"
                    className="dv-input w-32"
                    placeholder="notion_integration"
                    value={newCategoryKey}
                    onChange={(e) => setNewCategoryKey(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="new-connector-cat-label" className="block text-[11px] text-[var(--muted)] mb-1">
                    Label
                  </label>
                  <input
                    id="new-connector-cat-label"
                    className="dv-input w-40"
                    placeholder="Notion Integration"
                    value={newCategoryLabel}
                    onChange={(e) => setNewCategoryLabel(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="new-connector-cat-color" className="block text-[11px] text-[var(--muted)] mb-1">
                    Color
                  </label>
                  <input
                    id="new-connector-cat-color"
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
            <label htmlFor="connector-tags" className={labelClass}>
              Tags <span className="normal-case font-[family-name:var(--font-body)] text-[var(--muted)]">(comma-separated)</span>
            </label>
            <input
              id="connector-tags"
              className="dv-input"
              value={fields.tagsInput}
              onChange={(e) => setField("tagsInput", e.target.value)}
              placeholder="mcp, github, api"
            />
          </div>

          <div className="h-px bg-[var(--border)] my-1" />

          <div>
            <label htmlFor="connector-setup-steps" className={labelClass}>
              Setup Steps
            </label>
            <textarea
              id="connector-setup-steps"
              className="dv-input resize-y"
              rows={3}
              value={fields.setup_steps}
              onChange={(e) => setField("setup_steps", e.target.value)}
              placeholder="The install/config walkthrough"
            />
          </div>
          <div>
            <label htmlFor="connector-config-snippet" className={labelClass}>
              Config Snippet
            </label>
            <textarea
              id="connector-config-snippet"
              className="dv-input resize-y"
              style={{ fontFamily: "var(--font-mono)" }}
              rows={3}
              value={fields.config_snippet}
              onChange={(e) => setField("config_snippet", e.target.value)}
              placeholder="e.g. an MCP server entry or API client boilerplate"
            />
          </div>
          <div>
            <label htmlFor="connector-gotchas-notes" className={labelClass}>
              Gotchas / Notes
            </label>
            <textarea
              id="connector-gotchas-notes"
              className="dv-input resize-y"
              rows={2}
              value={fields.gotchas_notes}
              onChange={(e) => setField("gotchas_notes", e.target.value)}
              placeholder="Rate limits, auth scopes, common failure modes"
            />
          </div>
          <div>
            <label htmlFor="connector-docs-links" className={labelClass}>
              Docs Links
            </label>
            <textarea
              id="connector-docs-links"
              className="dv-input resize-y"
              style={{ fontFamily: "var(--font-mono)" }}
              rows={2}
              value={fields.docs_links}
              onChange={(e) => setField("docs_links", e.target.value)}
              placeholder="[LINK: official docs]"
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
              {isEdit ? "Save changes" : "Publish connector"}
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
