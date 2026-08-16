import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PromptCategory, PromptStatus } from "@/lib/types/database.types";

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

export const PROMPTS_PAGE_SIZE = 20;

export interface PromptListPage {
  offset?: number;
  limit?: number;
}

/** Filtered results for the Browse page grid — goes through the
 * `search_prompts` RPC so filter logic lives in one tested place.
 * Paginated: defaults to the first page of PROMPTS_PAGE_SIZE, used both
 * for the initial server-rendered page and subsequent infinite-scroll
 * "load more" calls (see app/actions/prompts.ts's loadMorePrompts). */
export async function searchPrompts(
  supabase: Client,
  filters: PromptListFilters,
  page: PromptListPage = {}
): Promise<PromptWithTags[]> {
  const { data, error } = await supabase.rpc("search_prompts", {
    p_category: filters.category ?? null,
    p_tags: filters.tags && filters.tags.length > 0 ? filters.tags : null,
    p_query: filters.q ?? null,
    p_limit: page.limit ?? PROMPTS_PAGE_SIZE,
    p_offset: page.offset ?? 0,
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
  const { data } = await supabase.from("prompts").select("category").eq("status", "approved");
  for (const row of data ?? []) {
    base[row.category as PromptCategory] += 1;
  }
  return base;
}

export async function totalPublishedCount(supabase: Client): Promise<number> {
  const { count } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");
  return count ?? 0;
}

/** Distinct tags in use, for the legend's tag chips. */
export async function allTags(supabase: Client): Promise<string[]> {
  const { data } = await supabase.from("tags").select("name").order("name");
  return (data ?? []).map((t) => t.name);
}

// ─── Review queue (admin) ──────────────────────────────────────────────

export interface ReviewQueueRow extends PromptRow {
  author: { full_name: string | null; email: string } | null;
}

/** Counts per status, for the admin nav badge and queue tab labels. Only
 * meaningful for an admin caller — RLS hides other users' non-approved
 * rows from everyone else, so a non-admin gets their own counts only. */
export async function reviewQueueCounts(
  supabase: Client
): Promise<Record<PromptStatus, number>> {
  const base: Record<PromptStatus, number> = {
    pending_review: 0,
    approved: 0,
    rejected: 0,
  };
  const { data } = await supabase.from("prompts").select("status");
  for (const row of data ?? []) {
    base[row.status as PromptStatus] += 1;
  }
  return base;
}

/** Prompts in a given review status, with the author attached, for the
 * admin review queue. Pending prompts are oldest-first (FIFO, so the
 * queue drains in submission order); decided prompts are most-recently-
 * reviewed-first (so the newest decisions surface at the top of the
 * Approved/Rejected tabs). */
export async function listReviewQueue(
  supabase: Client,
  status: PromptStatus
): Promise<ReviewQueueRow[]> {
  const { data } = await supabase
    .from("prompts")
    .select("*, author:profiles!prompts_author_id_fkey(full_name, email)")
    .eq("status", status)
    .order(status === "pending_review" ? "created_at" : "reviewed_at", {
      ascending: status === "pending_review",
    });
  return (data ?? []) as unknown as ReviewQueueRow[];
}

/** The caller's own prompts across every status, for the "My Submissions"
 * panel — the one place an author can see their own pending/rejected work,
 * since the public Browse grid only ever shows approved prompts. */
export async function mySubmissions(supabase: Client, userId: string): Promise<PromptRow[]> {
  const { data } = await supabase
    .from("prompts")
    .select("*")
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
