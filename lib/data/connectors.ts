import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ConnectorStatus } from "@/lib/types/database.types";
import type { CategoryDisplay } from "@/lib/data/categories";

type Client = SupabaseClient<Database>;
export type ConnectorRow = Database["public"]["Tables"]["connectors"]["Row"];

// Same categories(...) embed pattern as lib/data/{prompts,skills}.ts.
export interface ConnectorWithCategory extends ConnectorRow {
  categories: CategoryDisplay | null;
}
export interface ConnectorWithTags extends ConnectorWithCategory {
  tags: string[];
}

const CONNECTOR_SELECT_WITH_CATEGORY = "*, categories(key, label, color)";

export interface ConnectorListFilters {
  categoryId?: string | null;
  tags?: string[];
  q?: string;
}

async function attachTags(supabase: Client, connectors: ConnectorWithCategory[]): Promise<ConnectorWithTags[]> {
  if (connectors.length === 0) return [];

  const { data: joins } = await supabase
    .from("connector_tags")
    .select("connector_id, tags(name)")
    .in(
      "connector_id",
      connectors.map((c) => c.id)
    );

  const tagsByConnector = new Map<string, string[]>();
  for (const row of joins ?? []) {
    const name = (row.tags as unknown as { name: string } | null)?.name;
    if (!name) continue;
    const list = tagsByConnector.get(row.connector_id) ?? [];
    list.push(name);
    tagsByConnector.set(row.connector_id, list);
  }

  return connectors.map((c) => ({ ...c, tags: tagsByConnector.get(c.id) ?? [] }));
}

export const CONNECTORS_PAGE_SIZE = 20;

export interface ConnectorListPage {
  offset?: number;
  limit?: number;
}

/** Filtered results for the Browse page grid — mirrors
 * lib/data/{prompts,skills}.ts's searchPrompts/searchSkills. */
export async function searchConnectors(
  supabase: Client,
  filters: ConnectorListFilters,
  page: ConnectorListPage = {}
): Promise<ConnectorWithTags[]> {
  const { data, error } = await supabase
    .rpc("search_connectors", {
      p_category_id: filters.categoryId ?? null,
      p_tags: filters.tags && filters.tags.length > 0 ? filters.tags : null,
      p_query: filters.q ?? null,
      p_limit: page.limit ?? CONNECTORS_PAGE_SIZE,
      p_offset: page.offset ?? 0,
    })
    .select(CONNECTOR_SELECT_WITH_CATEGORY);
  if (error || !data) return [];
  return attachTags(supabase, data as unknown as ConnectorWithCategory[]);
}

/** Unfiltered totals for the legend rail, keyed by category id. */
export async function categoryCounts(supabase: Client): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const { data } = await supabase.from("connectors").select("category_id").eq("status", "approved");
  for (const row of data ?? []) {
    counts[row.category_id] = (counts[row.category_id] ?? 0) + 1;
  }
  return counts;
}

export async function totalPublishedCount(supabase: Client): Promise<number> {
  const { count } = await supabase
    .from("connectors")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved");
  return count ?? 0;
}

/** Distinct tags in use, for the legend's tag chips. */
export async function allTags(supabase: Client): Promise<string[]> {
  const { data } = await supabase.from("connector_tags").select("tags(name)").order("tag_id");
  const names = new Set<string>();
  for (const row of data ?? []) {
    const name = (row.tags as unknown as { name: string } | null)?.name;
    if (name) names.add(name);
  }
  return Array.from(names).sort();
}

// ─── Review queue (admin) ──────────────────────────────────────────────

export interface ReviewQueueRow extends ConnectorWithCategory {
  author: { full_name: string | null; email: string } | null;
}

export async function reviewQueueCounts(supabase: Client): Promise<Record<ConnectorStatus, number>> {
  const base: Record<ConnectorStatus, number> = {
    pending_review: 0,
    approved: 0,
    rejected: 0,
  };
  const { data } = await supabase.from("connectors").select("status");
  for (const row of data ?? []) {
    base[row.status as ConnectorStatus] += 1;
  }
  return base;
}

export async function listReviewQueue(supabase: Client, status: ConnectorStatus): Promise<ReviewQueueRow[]> {
  const { data } = await supabase
    .from("connectors")
    .select(`${CONNECTOR_SELECT_WITH_CATEGORY}, author:profiles!connectors_author_id_fkey(full_name, email)`)
    .eq("status", status)
    .order(status === "pending_review" ? "created_at" : "reviewed_at", {
      ascending: status === "pending_review",
    });
  return (data ?? []) as unknown as ReviewQueueRow[];
}

/** The caller's own connectors across every status, for a "My Submissions"
 * panel — mirrors lib/data/{prompts,skills}.ts's mySubmissions. */
export async function mySubmissions(supabase: Client, userId: string): Promise<ConnectorWithCategory[]> {
  const { data } = await supabase
    .from("connectors")
    .select(CONNECTOR_SELECT_WITH_CATEGORY)
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as ConnectorWithCategory[];
}
