import { z } from "zod";

// 20,000 chars matches the CHECK constraints added on public.prompts by
// supabase/migrations/20260818110400_prompt_text_length_constraints.sql — keep both
// in sync so a form submission that would fail the DB constraint is
// rejected here first, with a message the user can actually act on,
// instead of surfacing as a generic safeActionError() failure.
const GUIDANCE_MAX = 20000;

export const promptSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(140),
  description: z.string().trim().min(1, "Description is required.").max(300),
  // Categories moved off a fixed enum onto the admin-managed `categories`
  // table (20260824130000_categories.sql) — validated as a real row, not a
  // compile-time list, so a category added via PromptForm's inline
  // "+ New category" control is immediately valid here too.
  category_id: z.string().uuid("Please pick a category."),
  tagsInput: z.string().trim().optional().default(""),
  base_instructions: z
    .string()
    .trim()
    .min(1, "Task framing is required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  fill_in_details_guidance: z
    .string()
    .trim()
    .min(1, "Fill-in-your-details guidance is required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  reference_projects_guidance: z
    .string()
    .trim()
    .min(1, "Reference-projects guidance is required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  reference_links_guidance: z
    .string()
    .trim()
    .min(1, "Reference-links guidance is required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  expected_output_notes: z
    .string()
    .trim()
    .min(1, "Expected-output notes are required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
});

export type PromptFormValues = z.infer<typeof promptSchema>;

/** Turns "api, postgres, auth" into normalized, deduped tag slugs+names. */
export function parseTagsInput(input: string): { name: string; slug: string }[] {
  const seen = new Set<string>();
  return input
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
    .filter((t) => {
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    })
    .map((name) => ({ name, slug: name.replace(/\s+/g, "-") }));
}

export function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The exact copy-paste assembly format, shared by the form's live preview
 * and the detail page's CopyButton so they never drift. */
export function assembleTemplate(fields: {
  base_instructions: string;
  fill_in_details_guidance: string;
  reference_projects_guidance: string;
  reference_links_guidance: string;
  expected_output_notes: string;
}): string {
  return [
    "## Task Context",
    fields.base_instructions || "—",
    "",
    "## Fill In Your Details",
    fields.fill_in_details_guidance || "—",
    "",
    "## Similar Reference Projects",
    fields.reference_projects_guidance || "—",
    "",
    "## Reference Links",
    fields.reference_links_guidance || "—",
    "",
    "## Expected Output",
    fields.expected_output_notes || "—",
  ].join("\n");
}
