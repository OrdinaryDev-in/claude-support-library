import { z } from "zod";
import { parseTagsInput, slugify } from "@/lib/validation/shared";

export { parseTagsInput, slugify };

// 20,000 chars matches the CHECK constraints added on public.connectors by
// supabase/migrations/20260824150000_connectors.sql — same reasoning as
// lib/validation/{prompt,skill}-schema.ts's GUIDANCE_MAX.
const GUIDANCE_MAX = 20000;

export const connectorSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(140),
  description: z.string().trim().min(1, "Description is required.").max(300),
  // Categories are the shared, admin-managed `categories` table
  // (resource_type: "connector") — same pattern as Prompts/Skills.
  category_id: z.string().uuid("Please pick a category."),
  tagsInput: z.string().trim().optional().default(""),
  setup_steps: z
    .string()
    .trim()
    .min(1, "Setup steps are required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  config_snippet: z
    .string()
    .trim()
    .min(1, "A config snippet is required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  gotchas_notes: z
    .string()
    .trim()
    .min(1, "Gotchas/notes are required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  docs_links: z
    .string()
    .trim()
    .min(1, "Docs links are required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
});

export type ConnectorFormValues = z.infer<typeof connectorSchema>;

/** The exact copy-paste assembly format, shared by the form's live preview
 * and the detail page's CopyButton — same convention as
 * lib/validation/{prompt,skill}-schema.ts's assembleTemplate. */
export function assembleConnectorTemplate(fields: {
  setup_steps: string;
  config_snippet: string;
  gotchas_notes: string;
  docs_links: string;
}): string {
  return [
    "## Setup Steps",
    fields.setup_steps || "—",
    "",
    "## Config Snippet",
    fields.config_snippet || "—",
    "",
    "## Gotchas / Notes",
    fields.gotchas_notes || "—",
    "",
    "## Docs Links",
    fields.docs_links || "—",
  ].join("\n");
}
