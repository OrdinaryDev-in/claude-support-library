import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

type Client = SupabaseClient<Database>;
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type CategoryResourceType = CategoryRow["resource_type"];

/** The shape returned by a `categories(key, label, color)` embed on a
 * prompts/skills/connectors select — a many-to-one FK embed, so
 * supabase-js returns a single object (or null), not an array; see
 * lib/data/prompts.ts's attachTags for the same to-one embed pattern
 * already used for prompt_tags → tags. */
export type CategoryDisplay = Pick<CategoryRow, "key" | "label" | "color">;

const UNCATEGORIZED: CategoryDisplay = { key: "uncategorized", label: "Uncategorized", color: "var(--muted)" };

/** Every row this app fetches embeds its category via the FK, so this
 * should only ever hit the fallback for a row created before
 * category_id existed and never backfilled — defensive, not expected. */
export function categoryDisplay(category: CategoryDisplay | null): CategoryDisplay {
  return category ?? UNCATEGORIZED;
}

/** All categories for one resource type, in display order — the source
 * both the admin manager page and (from Part 2 onward) LibraryFilters read
 * from, replacing the old static PROMPT_CATEGORIES-style files. */
export async function listCategories(
  supabase: Client,
  resourceType?: CategoryResourceType
): Promise<CategoryRow[]> {
  let query = supabase.from("categories").select("*").order("sort_order").order("label");
  if (resourceType) query = query.eq("resource_type", resourceType);
  const { data } = await query;
  return data ?? [];
}
