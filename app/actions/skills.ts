"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeActionError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  searchSkills,
  SKILLS_PAGE_SIZE,
  type SkillListFilters,
  type SkillWithTags,
} from "@/lib/data/skills";
import {
  skillSchema,
  parseTagsInput,
  slugify,
  type SkillFormValues,
} from "@/lib/validation/skill-schema";

export type SkillActionResult = { ok: true; slug: string } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Same shape/reasoning as app/actions/prompts.ts's PROMPT_WRITE_RATE_LIMIT
// — a separate bucket per resource type, keyed by user.
const SKILL_WRITE_RATE_LIMIT = { max: 20, windowMs: 60_000 };

function checkSkillWriteRateLimit(userId: string): { allowed: boolean } {
  return checkRateLimit(`skill-write:${userId}`, SKILL_WRITE_RATE_LIMIT);
}

async function isAuthorOrAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  authorId: string
) {
  if (userId === authorId) return true;
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
  return data?.role === "admin";
}

/** Generates a unique slug, appending -2, -3... on collision — mirrors
 * app/actions/prompts.ts's uniqueSlug. */
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
  excludeId?: string
) {
  const root = slugify(base) || "skill";
  let candidate = root;
  let attempt = 1;
  while (true) {
    let query = supabase.from("skills").select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    attempt += 1;
    candidate = `${root}-${attempt}`;
  }
}

async function syncTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  skillId: string,
  tagsInput: string
) {
  const parsed = parseTagsInput(tagsInput);

  await supabase.from("skill_tags").delete().eq("skill_id", skillId);
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
      await supabase.from("skill_tags").insert({ skill_id: skillId, tag_id: tagId });
    }
  }
}

export async function createSkill(values: SkillFormValues): Promise<SkillActionResult> {
  const { supabase, user } = await requireUser();

  if (!checkSkillWriteRateLimit(user.id).allowed) {
    return { ok: false, error: "Too many changes — please wait a minute and try again." };
  }

  const parsed = skillSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const fields = parsed.data;

  const slug = await uniqueSlug(supabase, fields.title);

  const { data, error } = await supabase
    .from("skills")
    .insert({
      author_id: user.id,
      title: fields.title,
      slug,
      description: fields.description,
      category_id: fields.category_id,
      trigger_description: fields.trigger_description,
      instructions_body: fields.instructions_body,
      required_tools_guidance: fields.required_tools_guidance,
      example_usage: fields.example_usage,
      expected_output_notes: fields.expected_output_notes,
    })
    .select("id, slug")
    .single();

  if (error || !data) {
    return { ok: false, error: safeActionError("createSkill", error, "Could not create the skill.") };
  }

  await syncTags(supabase, data.id, fields.tagsInput ?? "");

  revalidatePath("/library/skills");
  return { ok: true, slug: data.slug };
}

export async function updateSkill(skillId: string, values: SkillFormValues): Promise<SkillActionResult> {
  const { supabase, user } = await requireUser();

  if (!checkSkillWriteRateLimit(user.id).allowed) {
    return { ok: false, error: "Too many changes — please wait a minute and try again." };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("skills")
    .select("id, author_id, slug, title")
    .eq("id", skillId)
    .single();

  if (fetchError || !existing) {
    return { ok: false, error: "Skill not found." };
  }
  if (!(await isAuthorOrAdmin(supabase, user.id, existing.author_id))) {
    return { ok: false, error: "You don't have permission to edit this skill." };
  }

  const parsed = skillSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const fields = parsed.data;

  const slug =
    fields.title === existing.title ? existing.slug : await uniqueSlug(supabase, fields.title, existing.id);

  const { error } = await supabase
    .from("skills")
    .update({
      title: fields.title,
      slug,
      description: fields.description,
      category_id: fields.category_id,
      trigger_description: fields.trigger_description,
      instructions_body: fields.instructions_body,
      required_tools_guidance: fields.required_tools_guidance,
      example_usage: fields.example_usage,
      expected_output_notes: fields.expected_output_notes,
    })
    .eq("id", skillId);

  if (error) {
    return { ok: false, error: safeActionError("updateSkill", error, "Could not save your changes.") };
  }

  await syncTags(supabase, skillId, fields.tagsInput ?? "");

  revalidatePath("/library/skills");
  revalidatePath(`/library/skills/${slug}`);
  return { ok: true, slug };
}

export async function deleteSkill(skillId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();

  if (!checkSkillWriteRateLimit(user.id).allowed) {
    return { ok: false, error: "Too many changes — please wait a minute and try again." };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("skills")
    .select("id, author_id")
    .eq("id", skillId)
    .single();

  if (fetchError || !existing) {
    return { ok: false, error: "Skill not found." };
  }
  if (!(await isAuthorOrAdmin(supabase, user.id, existing.author_id))) {
    return { ok: false, error: "You don't have permission to delete this skill." };
  }

  const { error } = await supabase.from("skills").delete().eq("id", skillId);
  if (error) return { ok: false, error: safeActionError("deleteSkill", error, "Could not delete the skill.") };

  revalidatePath("/library/skills");
  return { ok: true };
}

/** Fetches the next page of the Browse grid for infinite scroll — mirrors
 * app/actions/prompts.ts's loadMorePrompts. */
export async function loadMoreSkills(
  filters: SkillListFilters,
  offset: number
): Promise<{ skills: SkillWithTags[] }> {
  const supabase = await createClient();
  const skills = await searchSkills(supabase, filters, { offset, limit: SKILLS_PAGE_SIZE });
  return { skills };
}

export async function duplicateSkill(skillId: string): Promise<SkillActionResult> {
  const { supabase, user } = await requireUser();

  if (!checkSkillWriteRateLimit(user.id).allowed) {
    return { ok: false, error: "Too many changes — please wait a minute and try again." };
  }

  const { data: source, error: fetchError } = await supabase
    .from("skills")
    .select(
      "title, description, category_id, trigger_description, instructions_body, required_tools_guidance, example_usage, expected_output_notes"
    )
    .eq("id", skillId)
    .single();

  if (fetchError || !source) {
    return { ok: false, error: "Skill not found." };
  }

  const { data: sourceTags } = await supabase
    .from("skill_tags")
    .select("tags(name)")
    .eq("skill_id", skillId);
  const tagsInput = (sourceTags ?? [])
    .map((row) => (row.tags as unknown as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");

  const title = `${source.title} (Copy)`;
  const slug = await uniqueSlug(supabase, title);

  const { data: created, error } = await supabase
    .from("skills")
    .insert({
      author_id: user.id,
      title,
      slug,
      description: source.description,
      category_id: source.category_id,
      trigger_description: source.trigger_description,
      instructions_body: source.instructions_body,
      required_tools_guidance: source.required_tools_guidance,
      example_usage: source.example_usage,
      expected_output_notes: source.expected_output_notes,
    })
    .select("id, slug")
    .single();

  if (error || !created) {
    return { ok: false, error: safeActionError("duplicateSkill", error, "Could not duplicate the skill.") };
  }

  await syncTags(supabase, created.id, tagsInput);

  revalidatePath("/library/skills");
  return { ok: true, slug: created.slug };
}
