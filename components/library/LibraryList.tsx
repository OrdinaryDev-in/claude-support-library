"use client";

import { cloneElement, isValidElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";

export interface LibraryListProps<T> {
  initialItems: T[];
  /** Page size — "more to load" is inferred from whether the last page
   * came back full, not a separate total count (see PromptsGrid's original
   * comment: a total would have to be re-derived under the current filters
   * to stay correct, and getting that wrong means requesting pages that
   * come back empty forever). */
  pageSize: number;
  loadMore: (offset: number) => Promise<T[]>;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  renderSkeleton: () => ReactNode;
  onCountChange?: (count: number) => void;
  renderEndMessage?: (count: number) => ReactNode;
}

/** Generalized infinite-scroll/pagination grid — extracted from
 * components/library/PromptsGrid.tsx (Phase 2, Part 2) so Skills/Connectors
 * reuse this instead of copy-pasting the IntersectionObserver plumbing.
 * PromptsGrid is now a thin instantiation of this passing `loadMorePrompts`
 * and a `LibraryCard` adapter — see its own file. Give this component
 * `key={filterKey}` from the parent page (as PromptsGrid always has) so a
 * filter/search change remounts it with a fresh offset instead of
 * appending onto a now-stale list. */
export function LibraryList<T>({
  initialItems,
  pageSize,
  loadMore,
  getKey,
  renderItem,
  renderSkeleton,
  onCountChange,
  renderEndMessage,
}: LibraryListProps<T>) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialItems.length === pageSize);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false); // mirrors `loading` synchronously for the observer callback

  async function fetchNextPage() {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setErrored(false);
    try {
      const next = await loadMore(items.length);
      const merged = [...items, ...next];
      setItems(merged);
      onCountChange?.(merged.length);
      setHasMore(next.length === pageSize);
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
    // A filters/loadMore identity change is handled by the parent
    // remounting this component via `key`, not by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, items.length]);

  // cloneElement (not a wrapping <div>) so renderItem's own element — e.g.
  // LibraryCard's <Link>, a CSS grid item that relies on the grid's default
  // stretch behavior — stays the direct grid child. An extra wrapper div
  // would change how it's sized within the grid.
  function keyed(item: T, node: ReactNode): ReactNode {
    const key = getKey(item);
    return isValidElement(node) ? cloneElement(node as ReactElement<{ key?: string }>, { key }) : <div key={key}>{node}</div>;
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {items.map((item) => keyed(item, renderItem(item)))}
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={`loading-${i}`}>{renderSkeleton()}</div>
          ))}
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

      {!hasMore && items.length > initialItems.length && renderEndMessage && (
        <div className="text-center py-6 font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)]">
          {renderEndMessage(items.length)}
        </div>
      )}
    </>
  );
}
