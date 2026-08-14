import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PromptCategory } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;
export type PromptRow = Database["public"]["Tables"]["prompts"]["Row"];
export interface PromptWithTags extends PromptRow {
  tags: string[];
}

export interface PromptListFilters {
  category?: PromptCategory | null;
  tags?: string[];
  q?: string;
}

async function attachTags(supabase: Client, prompts: PromptRow[]): Promise<PromptWithTags[]> {
  if (prompts.length === 0) return [];

  const { data: joins } = await supabase
    .from("prompt_tags")
    .select("prompt_id, tags(name)")
    .in(
      "prompt_id",
      prompts.map((p) => p.id)
    );

  const tagsByPrompt = new Map<string, string[]>();
  for (const row of joins ?? []) {
    const name = (row.tags as unknown as { name: string } | null)?.name;
    if (!name) continue;
    const list = tagsByPrompt.get(row.prompt_id) ?? [];
    list.push(name);
    tagsByPrompt.set(row.prompt_id, list);
  }

  return prompts.map((p) => ({ ...p, tags: tagsByPrompt.get(p.id) ?? [] }));
}

/** Filtered results for the Browse page grid — goes through the
 * `search_prompts` RPC so filter logic lives in one tested place. */
export async function searchPrompts(
  supabase: Client,
  filters: PromptListFilters
): Promise<PromptWithTags[]> {
  const { data, error } = await supabase.rpc("search_prompts", {
    p_category: filters.category ?? null,
    p_tags: filters.tags && filters.tags.length > 0 ? filters.tags : null,
    p_query: filters.q ?? null,
    p_limit: 20,
    p_offset: 0,
  });
  if (error || !data) return [];
  return attachTags(supabase, data);
}

/** Unfiltered totals for the legend rail — reflects the whole library, not
 * the current filter selection (matches the design's static legend). */
export async function categoryCounts(
  supabase: Client
): Promise<Record<PromptCategory, number>> {
  const base: Record<PromptCategory, number> = {
    new_app: 0,
    module_feature: 0,
    debugging: 0,
    frontend: 0,
    backend: 0,
  };
  const { data } = await supabase.from("prompts").select("category").eq("is_published", true);
  for (const row of data ?? []) {
    base[row.category as PromptCategory] += 1;
  }
  return base;
}

export async function totalPublishedCount(supabase: Client): Promise<number> {
  const { count } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);
  return count ?? 0;
}

/** Distinct tags in use, for the legend's tag chips. */
export async function allTags(supabase: Client): Promise<string[]> {
  const { data } = await supabase.from("tags").select("name").order("name");
  return (data ?? []).map((t) => t.name);
}
