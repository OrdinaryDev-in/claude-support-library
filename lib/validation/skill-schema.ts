import { z } from "zod";
import { parseTagsInput, slugify } from "@/lib/validation/shared";

export { parseTagsInput, slugify };

// 20,000 chars matches the CHECK constraints added on public.skills by
// supabase/migrations/20260824140000_skills.sql — keep both in sync so a
// form submission that would fail the DB constraint is rejected here
// first, with a message the user can actually act on (same reasoning as
// lib/validation/prompt-schema.ts's GUIDANCE_MAX).
const GUIDANCE_MAX = 20000;

export const skillSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(140),
  description: z.string().trim().min(1, "Description is required.").max(300),
  // Categories are the shared, admin-managed `categories` table
  // (resource_type: "skill") — same pattern as Prompts, not a fixed enum.
  category_id: z.string().uuid("Please pick a category."),
  tagsInput: z.string().trim().optional().default(""),
  trigger_description: z
    .string()
    .trim()
    .min(1, "Trigger description is required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  instructions_body: z
    .string()
    .trim()
    .min(1, "Instructions are required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  required_tools_guidance: z
    .string()
    .trim()
    .min(1, "Required-tools guidance is required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  example_usage: z
    .string()
    .trim()
    .min(1, "An example is required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
  expected_output_notes: z
    .string()
    .trim()
    .min(1, "Expected-output notes are required.")
    .max(GUIDANCE_MAX, `Keep this under ${GUIDANCE_MAX.toLocaleString()} characters.`),
});

export type SkillFormValues = z.infer<typeof skillSchema>;

/** The exact copy-paste assembly format, shared by the form's live preview
 * and the detail page's CopyButton so they never drift — same convention
 * as lib/validation/prompt-schema.ts's assembleTemplate. */
export function assembleSkillTemplate(fields: {
  trigger_description: string;
  instructions_body: string;
  required_tools_guidance: string;
  example_usage: string;
  expected_output_notes: string;
}): string {
  return [
    "## When To Use This Skill",
    fields.trigger_description || "—",
    "",
    "## Instructions",
    fields.instructions_body || "—",
    "",
    "## Required Tools / Capabilities",
    fields.required_tools_guidance || "—",
    "",
    "## Example Usage",
    fields.example_usage || "—",
    "",
    "## Expected Output",
    fields.expected_output_notes || "—",
  ].join("\n");
}
