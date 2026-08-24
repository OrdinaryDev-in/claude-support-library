import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { searchConnectors, categoryCounts, allTags, totalPublishedCount } from "@/lib/data/connectors";
import { listCategories } from "@/lib/data/categories";
import { LibraryFilters } from "@/components/library/LibraryFilters";
import { ConnectorsGrid } from "@/components/library/ConnectorsGrid";
import { ConnectorsCountProvider, useConnectorsCount } from "@/components/library/ConnectorsCountContext";
import { LoadedCount } from "@/components/library/LoadedCount";

// See app/(app)/library/page.tsx's comment on why this is noindex despite
// otherwise looking like the app's most SEO-relevant page.
export const metadata: Metadata = {
  title: "Connectors",
  robots: { index: false, follow: false },
};

/** The Connectors counterpart to app/(app)/library/skills/page.tsx — same
 * structure, built on the same generic LibraryFilters/LibraryList. */
export default async function BrowseConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tags?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const categories = await listCategories(supabase, "connector");
  const categoryKey = params.category || null;
  const categoryId = categoryKey ? (categories.find((c) => c.key === categoryKey)?.id ?? null) : null;

  const filters = {
    categoryId,
    tags: params.tags ? params.tags.split(",").filter(Boolean) : [],
    q: params.q || "",
  };

  const [connectors, counts, tags, total] = await Promise.all([
    searchConnectors(supabase, filters),
    categoryCounts(supabase),
    allTags(supabase),
    totalPublishedCount(supabase),
  ]);

  const hasFilters = Boolean(categoryKey) || filters.tags.length > 0 || Boolean(filters.q);
  const filterKey = `${filters.categoryId ?? ""}|${filters.tags.slice().sort().join(",")}|${filters.q}`;

  return (
    <ConnectorsCountProvider key={filterKey} initialCount={connectors.length}>
      <div className="flex-1 w-full mx-auto max-w-[1180px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
        <div className="flex items-start sm:items-baseline justify-between gap-4 mb-6 sm:mb-9 flex-wrap">
          <div>
            <h1 className="font-[family-name:var(--font-display)] font-medium text-[26px] sm:text-[30px] mb-1">
              Connectors
            </h1>
            <div className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
              § VOLUME III · <LoadedCount total={total} useCount={useConnectorsCount} />
            </div>
          </div>
          <Link
            href="/library/connectors/new"
            className="no-underline px-4 py-2 border border-[var(--brass)] text-[var(--brass)] rounded-md text-[13px] font-semibold hover:bg-[var(--brass)]/10 transition-colors"
          >
            + New connector
          </Link>
        </div>

        <div className="flex flex-col md:flex-row gap-6 md:gap-10">
          <LibraryFilters categories={categories} counts={counts} tags={tags} />

          <div className="flex-1 min-w-0">
            {connectors.length === 0 ? (
              <div className="text-center py-20 px-5 border border-dashed border-[var(--border)] rounded-lg">
                <div className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--muted)] mb-2">
                  No connectors match these filters.
                </div>
                {hasFilters && (
                  <Link href="/library/connectors" className="text-[var(--brass)] text-[13px] no-underline">
                    → Clear filters to see all {total}.
                  </Link>
                )}
              </div>
            ) : (
              <ConnectorsGrid initialConnectors={connectors} filters={filters} />
            )}
          </div>
        </div>
      </div>
    </ConnectorsCountProvider>
  );
}
