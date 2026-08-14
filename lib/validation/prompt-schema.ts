import { z } from "zod";

export const promptCategoryValues = [
  "new_app",
  "module_feature",
  "debugging",
  "frontend",
  "backend",
] as const;

export const promptSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(140),
  description: z.string().trim().min(1, "Description is required.").max(300),
  category: z.enum(promptCategoryValues),
  tagsInput: z.string().trim().optional().default(""),
  base_instructions: z.string().trim().min(1, "Task framing is required."),
  fill_in_details_guidance: z
    .string()
    .trim()
    .min(1, "Fill-in-your-details guidance is required."),
  reference_projects_guidance: z
    .string()
    .trim()
    .min(1, "Reference-projects guidance is required."),
  reference_links_guidance: z
    .string()
    .trim()
    .min(1, "Reference-links guidance is required."),
  expected_output_notes: z
    .string()
    .trim()
    .min(1, "Expected-output notes are required."),
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
