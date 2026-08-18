import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { searchPrompts, categoryCounts, allTags, totalPublishedCount } from "@/lib/data/prompts";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import { PromptsGrid } from "@/components/library/PromptsGrid";
import { PromptsCountProvider } from "@/components/library/PromptsCountContext";
import { LoadedCount } from "@/components/library/LoadedCount";
import type { PromptCategory } from "@/lib/types/database.types";

// See app/(app)/library/page.tsx's comment on why this is noindex despite
// otherwise looking like the app's most SEO-relevant page.
export const metadata: Metadata = {
  title: "Prompts",
  robots: { index: false, follow: false },
};

export default async function BrowsePromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tags?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const filters = {
    category: (params.category as PromptCategory) || null,
    tags: params.tags ? params.tags.split(",").filter(Boolean) : [],
    q: params.q || "",
  };

  const [prompts, counts, tags, total] = await Promise.all([
    searchPrompts(supabase, filters),
    categoryCounts(supabase),
    allTags(supabase),
    totalPublishedCount(supabase),
  ]);

  const hasFilters = Boolean(filters.category) || filters.tags.length > 0 || Boolean(filters.q);
  // Forces PromptsGrid to remount (fresh offset, no stale appended results)
  // whenever the filters actually change, instead of reusing client state
  // built up under a different filter set.
  const filterKey = `${filters.category ?? ""}|${filters.tags.slice().sort().join(",")}|${filters.q}`;

  return (
    <PromptsCountProvider key={filterKey} initialCount={prompts.length}>
      <div className="flex-1 w-full mx-auto max-w-[1180px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
        <div className="flex items-start sm:items-baseline justify-between gap-4 mb-6 sm:mb-9 flex-wrap">
          <div>
            <h1 className="font-[family-name:var(--font-display)] font-medium text-[26px] sm:text-[30px] mb-1">
              Prompts
            </h1>
            <div className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
              § VOLUME I · <LoadedCount total={total} />
            </div>
          </div>
          <Link
            href="/library/prompts/new"
            className="no-underline px-4 py-2 border border-[var(--brass)] text-[var(--brass)] rounded-md text-[13px] font-semibold hover:bg-[var(--brass)]/10 transition-colors"
          >
            + New prompt
          </Link>
        </div>

        <div className="flex flex-col md:flex-row gap-6 md:gap-10">
          <LibraryFilters counts={counts} tags={tags} />

          {/* Not a <main> — app/(app)/layout.tsx already provides the
              page's one <main> landmark; a nested second one is invalid
              HTML and ambiguous for assistive tech. */}
          <div className="flex-1 min-w-0">
            {prompts.length === 0 ? (
              <div className="text-center py-20 px-5 border border-dashed border-[var(--border)] rounded-lg">
                <div className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--muted)] mb-2">
                  No prompts match these filters.
                </div>
                {hasFilters && (
                  <Link href="/library/prompts" className="text-[var(--brass)] text-[13px] no-underline">
                    → Clear filters to see all {total}.
                  </Link>
                )}
              </div>
            ) : (
              <PromptsGrid initialPrompts={prompts} filters={filters} />
            )}
          </div>
        </div>
      </div>
    </PromptsCountProvider>
  );
}
