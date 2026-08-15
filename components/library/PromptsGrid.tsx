"use client";

import { useEffect, useRef, useState } from "react";
import { loadMorePrompts } from "@/app/actions/prompts";
import { PROMPTS_PAGE_SIZE, type PromptListFilters, type PromptWithTags } from "@/lib/data/prompts";
import { LibraryCard } from "@/components/library/LibraryCard";
import { PromptCardSkeleton } from "@/components/ui/Skeleton";
import { usePromptsCount } from "@/components/library/PromptsCountContext";

/** Renders the Browse-page grid and infinite-scrolls further pages in as
 * the user nears the bottom. `initialPrompts` is the server-rendered first
 * page (so the page has real content and works with JS disabled); this
 * component only takes over for page 2 onward. Give it `key={filterKey}`
 * from the parent so a filter/search change remounts it with a fresh
 * offset instead of appending onto a now-stale list.
 *
 * "More to load" is inferred from whether the last page came back full
 * (== PROMPTS_PAGE_SIZE), not from a separate total count — a total count
 * would have to be re-derived under the *current filters* to be correct,
 * and getting that wrong (e.g. reusing the unfiltered library total) means
 * the grid keeps requesting pages that come back empty forever. */
export function PromptsGrid({
  initialPrompts,
  filters,
}: {
  initialPrompts: PromptWithTags[];
  filters: PromptListFilters;
}) {
  const [prompts, setPrompts] = useState(initialPrompts);
  const [hasMore, setHasMore] = useState(initialPrompts.length === PROMPTS_PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false); // mirrors `loading` synchronously for the observer callback
  const { setCount } = usePromptsCount();

  async function fetchNextPage() {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setErrored(false);
    try {
      const { prompts: next } = await loadMorePrompts(filters, prompts.length);
      const merged = [...prompts, ...next];
      setPrompts(merged);
      setCount(merged.length);
      setHasMore(next.length === PROMPTS_PAGE_SIZE);
    } catch {
      setErrored(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchNextPage();
      },
      // Start fetching a bit before the sentinel is actually on-screen so
      // the next page is ready by the time the user scrolls to it.
      { rootMargin: "600px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // Re-subscribe whenever the loaded count changes so the observer's
    // closure always fetches from the current offset, not a stale one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, prompts.length, filters]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {prompts.map((prompt) => (
          <LibraryCard key={prompt.id} prompt={prompt} />
        ))}
        {loading &&
          Array.from({ length: 3 }).map((_, i) => <PromptCardSkeleton key={`loading-${i}`} />)}
      </div>

      {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden />}

      {errored && (
        <div className="text-center py-6">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--brass)] underline"
          >
            {"Couldn't load more — retry"}
          </button>
        </div>
      )}

      {!hasMore && prompts.length > initialPrompts.length && (
        <div className="text-center py-6 font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)]">
          § end of volume — {prompts.length} charted
        </div>
      )}
    </>
  );
}
