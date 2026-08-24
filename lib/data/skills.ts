import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SkillStatus } from "@/lib/types/database.types";
import type { CategoryDisplay } from "@/lib/data/categories";

type Client = SupabaseClient<Database>;
export type SkillRow = Database["public"]["Tables"]["skills"]["Row"];

// Same categories(...) embed pattern as lib/data/prompts.ts's
// PromptWithCategory — a many-to-one FK embed, so supabase-js returns a
// single object/null, not an array.
export interface SkillWithCategory extends SkillRow {
  categories: CategoryDisplay | null;
}
export interface SkillWithTags extends SkillWithCategory {
  tags: string[];
}

const SKILL_SELECT_WITH_CATEGORY = "*, categories(key, label, color)";

export interface SkillListFilters {
  categoryId?: string | null;
  tags?: string[];
  q?: string;
}

async function attachTags(supabase: Client, skills: SkillWithCategory[]): Promise<SkillWithTags[]> {
  if (skills.length === 0) return [];

  const { data: joins } = await supabase
    .from("skill_tags")
    .select("skill_id, tags(name)")
    .in(
      "skill_id",
      skills.map((s) => s.id)
    );

  const tagsBySkill = new Map<string, string[]>();
  for (const row of joins ?? []) {
    const name = (row.tags as unknown as { name: string } | null)?.name;
    if (!name) continue;
    const list = tagsBySkill.get(row.skill_id) ?? [];
    list.push(name);
    tagsBySkill.set(row.skill_id, list);
  }

  return skills.map((s) => ({ ...s, tags: tagsBySkill.get(s.id) ?? [] }));
}

export const SKILLS_PAGE_SIZE = 20;

export interface SkillListPage {
  offset?: number;
  limit?: number;
}

/** Filtered results for the Browse page grid — goes through the
 * `search_skills` RPC so filter logic lives in one tested place. Mirrors
 * lib/data/prompts.ts's searchPrompts. */
export async function searchSkills(
  supabase: Client,
  filters: SkillListFilters,
  page: SkillListPage = {}
): Promise<SkillWithTags[]> {
  const { data, error } = await supabase
    .rpc("search_skills", {
      p_category_id: filters.categoryId ?? null,
      p_tags: filters.tags && filters.tags.length > 0 ? filters.tags : null,
      p_query: filters.q ?? null,
      p_limit: page.limit ?? SKILLS_PAGE_SIZE,
      p_offset: page.offset ?? 0,
    })
    .select(SKILL_SELECT_WITH_CATEGORY);
  if (error || !data) return [];
  return attachTags(supabase, data as unknown as SkillWithCategory[]);
}

/** Unfiltered totals for the legend rail, keyed by category id — mirrors
 * lib/data/prompts.ts's categoryCounts. */
export async function categoryCounts(supabase: Client): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const { data } = await supabase.from("skills").select("category_id").eq("status", "approved");
  for (const row of data ?? []) {
    counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
  }
  return counts;
}

export async function totalPublishedCount(supabase: Client): Promise<number> {
  const { count } = await supabase
    .from("skills")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");
  return count ?? 0;
}

/** Distinct tags in use, for the legend's tag chips. Shares the `tags`
 * table with Prompts, but only returns names actually attached to a
 * skill — a tag created only for a prompt shouldn't show up here. */
export async function allTags(supabase: Client): Promise<string[]> {
  const { data } = await supabase
    .from("skill_tags")
    .select("tags(name)")
    .order("tag_id");
  const names = new Set<string>();
  for (const row of data ?? []) {
    const name = (row.tags as unknown as { name: string } | null)?.name;
    if (name) names.add(name);
  }
  return Array.from(names).sort();
}

// ─── Review queue (admin) ──────────────────────────────────────────────

export interface ReviewQueueRow extends SkillWithCategory {
  author: { full_name: string | null; email: string } | null;
}

export async function reviewQueueCounts(supabase: Client): Promise<Record<SkillStatus, number>> {
  const base: Record<SkillStatus, number> = {
    pending_review: 0,
    approved: 0,
    rejected: 0,
  };
  const { data } = await supabase.from("skills").select("status");
  for (const row of data ?? []) {
    base[row.status as SkillStatus] += 1;
  }
  return base;
}

export async function listReviewQueue(supabase: Client, status: SkillStatus): Promise<ReviewQueueRow[]> {
  const { data } = await supabase
    .from("skills")
    .select(`${SKILL_SELECT_WITH_CATEGORY}, author:profiles!skills_author_id_fkey(full_name, email)`)
    .eq("status", status)
    .order(status === "pending_review" ? "created_at" : "reviewed_at", {
      ascending: status === "pending_review",
    });
  return (data ?? []) as unknown as ReviewQueueRow[];
}

/** The caller's own skills across every status, for the "My Submissions"
 * panel — mirrors lib/data/prompts.ts's mySubmissions. */
export async function mySubmissions(supabase: Client, userId: string): Promise<SkillWithCategory[]> {
  const { data } = await supabase
    .from("skills")
    .select(SKILL_SELECT_WITH_CATEGORY)
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as SkillWithCategory[];
}
