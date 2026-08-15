"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, isAuthorOrAdmin } from "@/lib/auth/require-user";
import {
  searchPrompts,
  PROMPTS_PAGE_SIZE,
  type PromptListFilters,
  type PromptWithTags,
} from "@/lib/data/prompts";
import {
  promptSchema,
  parseTagsInput,
  slugify,
  type PromptFormValues,
} from "@/lib/validation/prompt-schema";

export type PromptActionResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

/** Generates a unique slug, appending -2, -3... on collision. */
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
  excludeId?: string
) {
  const root = slugify(base) || "prompt";
  let candidate = root;
  let attempt = 1;
  while (true) {
    let query = supabase.from("prompts").select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    attempt += 1;
    candidate = `${root}-${attempt}`;
  }
}

async function syncTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  promptId: string,
  tagsInput: string
) {
  const parsed = parseTagsInput(tagsInput);

  // Clear existing links for this prompt, then re-attach — simplest
  // correct approach for a form that resubmits the whole tag list.
  await supabase.from("prompt_tags").delete().eq("prompt_id", promptId);
  if (parsed.length === 0) return;

  for (const tag of parsed) {
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("slug", tag.slug)
      .maybeSingle();

    const tagId =
      existing?.id ??
      (
        await supabase
          .from("tags")
          .insert({ name: tag.name, slug: tag.slug })
          .select("id")
          .single()
      ).data?.id;

    if (tagId) {
      await supabase.from("prompt_tags").insert({ prompt_id: promptId, tag_id: tagId });
    }
  }
}

export async function createPrompt(
  values: PromptFormValues
): Promise<PromptActionResult> {
  const { supabase, user } = await requireUser();

  const parsed = promptSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const fields = parsed.data;

  const slug = await uniqueSlug(supabase, fields.title);

  const { data, error } = await supabase
    .from("prompts")
    .insert({
      author_id: user.id,
      title: fields.title,
      slug,
      description: fields.description,
      category: fields.category,
      base_instructions: fields.base_instructions,
      fill_in_details_guidance: fields.fill_in_details_guidance,
      reference_projects_guidance: fields.reference_projects_guidance,
      reference_links_guidance: fields.reference_links_guidance,
      expected_output_notes: fields.expected_output_notes,
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create the prompt." };
  }

  await syncTags(supabase, data.id, fields.tagsInput ?? "");

  revalidatePath("/library/prompts");
  return { ok: true, slug: data.slug };
}

export async function updatePrompt(
  promptId: string,
  values: PromptFormValues
): Promise<PromptActionResult> {
  const { supabase, user } = await requireUser();

  const { data: existing, error: fetchError } = await supabase
    .from("prompts")
    .select("id, author_id, slug, title")
    .eq("id", promptId)
    .single();

  if (fetchError || !existing) {
    return { ok: false, error: "Prompt not found." };
  }
  if (!(await isAuthorOrAdmin(supabase, user.id, existing.author_id))) {
    return { ok: false, error: "You don't have permission to edit this prompt." };
  }

  const parsed = promptSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const fields = parsed.data;

  const slug =
    fields.title === existing.title
      ? existing.slug
      : await uniqueSlug(supabase, fields.title, existing.id);

  const { error } = await supabase
    .from("prompts")
    .update({
      title: fields.title,
      slug,
      description: fields.description,
      category: fields.category,
      base_instructions: fields.base_instructions,
      fill_in_details_guidance: fields.fill_in_details_guidance,
      reference_projects_guidance: fields.reference_projects_guidance,
      reference_links_guidance: fields.reference_links_guidance,
      expected_output_notes: fields.expected_output_notes,
    })
    .eq("id", promptId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await syncTags(supabase, promptId, fields.tagsInput ?? "");

  revalidatePath("/library/prompts");
  revalidatePath(`/library/prompts/${slug}`);
  return { ok: true, slug };
}

export async function deletePrompt(
  promptId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();

  const { data: existing, error: fetchError } = await supabase
    .from("prompts")
    .select("id, author_id")
    .eq("id", promptId)
    .single();

  if (fetchError || !existing) {
    return { ok: false, error: "Prompt not found." };
  }
  if (!(await isAuthorOrAdmin(supabase, user.id, existing.author_id))) {
    return { ok: false, error: "You don't have permission to delete this prompt." };
  }

  const { error } = await supabase.from("prompts").delete().eq("id", promptId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/library/prompts");
  return { ok: true };
}

/** Fetches the next page of the Browse grid for infinite scroll.
 * `offset` is the number of prompts already loaded (initialPrompts.length,
 * then bumped by each successful call) — see components/library/PromptsGrid.tsx. */
export async function loadMorePrompts(
  filters: PromptListFilters,
  offset: number
): Promise<{ prompts: PromptWithTags[] }> {
  const supabase = await createClient();
  const prompts = await searchPrompts(supabase, filters, {
    offset,
    limit: PROMPTS_PAGE_SIZE,
  });
  return { prompts };
}

export async function duplicatePrompt(
  promptId: string
): Promise<PromptActionResult> {
  const { supabase, user } = await requireUser();

  const { data: source, error: fetchError } = await supabase
    .from("prompts")
    .select(
      "title, description, category, base_instructions, fill_in_details_guidance, reference_projects_guidance, reference_links_guidance, expected_output_notes"
    )
    .eq("id", promptId)
    .single();

  if (fetchError || !source) {
    return { ok: false, error: "Prompt not found." };
  }

  const { data: sourceTags } = await supabase
    .from("prompt_tags")
    .select("tags(name)")
    .eq("prompt_id", promptId);
  const tagsInput = (sourceTags ?? [])
    .map((row) => (row.tags as unknown as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");

  const title = `${source.title} (Copy)`;
  const slug = await uniqueSlug(supabase, title);

  const { data: created, error } = await supabase
    .from("prompts")
    .insert({
      author_id: user.id,
      title,
      slug,
      description: source.description,
      category: source.category,
      base_instructions: source.base_instructions,
      fill_in_details_guidance: source.fill_in_details_guidance,
      reference_projects_guidance: source.reference_projects_guidance,
      reference_links_guidance: source.reference_links_guidance,
      expected_output_notes: source.expected_output_notes,
    })
    .select("id, slug")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Could not duplicate the prompt." };
  }

  await syncTags(supabase, created.id, tagsInput);

  revalidatePath("/library/prompts");
  return { ok: true, slug: created.slug };
}
