"use client";

import { loadMorePrompts } from "@/app/actions/prompts";
import { PROMPTS_PAGE_SIZE, type PromptListFilters, type PromptWithTags } from "@/lib/data/prompts";
import { categoryDisplay } from "@/lib/data/categories";
import { LibraryList } from "@/components/library/LibraryList";
import { LibraryCard, type LibraryCardItem } from "@/components/library/LibraryCard";
import { PromptCardSkeleton } from "@/components/ui/Skeleton";
import { usePromptsCount } from "@/components/library/PromptsCountContext";

/** Adapter from a prompt row to the generic LibraryCard shape (Phase 2,
 * Part 2) — the only prompt-specific piece of what used to be this whole
 * file; everything else (pagination, infinite scroll) now lives in the
 * generic LibraryList this component instantiates. */
function promptToCardItem(prompt: PromptWithTags): LibraryCardItem {
  const cat = categoryDisplay(prompt.categories);
  return {
    href: `/library/prompts/${prompt.slug}`,
    title: prompt.title,
    description: prompt.description,
    tags: prompt.tags,
    category: { label: cat.label, color: cat.color },
    meta: `${prompt.view_count} uses`,
  };
}

/** Renders the Browse-page grid and infinite-scrolls further pages in as
 * the user nears the bottom. `initialPrompts` is the server-rendered first
 * page (so the page has real content and works with JS disabled); this
 * component only takes over for page 2 onward. Give it `key={filterKey}`
 * from the parent so a filter/search change remounts it with a fresh
 * offset instead of appending onto a now-stale list. */
export function PromptsGrid({
  initialPrompts,
  filters,
}: {
  initialPrompts: PromptWithTags[];
  filters: PromptListFilters;
}) {
  const { setCount } = usePromptsCount();

  return (
    <LibraryList
      initialItems={initialPrompts}
      pageSize={PROMPTS_PAGE_SIZE}
      loadMore={async (offset) => {
        const { prompts } = await loadMorePrompts(filters, offset);
        return prompts;
      }}
      getKey={(prompt) => prompt.id}
      renderItem={(prompt) => <LibraryCard item={promptToCardItem(prompt)} />}
      renderSkeleton={() => <PromptCardSkeleton />}
      onCountChange={setCount}
      renderEndMessage={(count) => `§ end of volume — ${count} charted`}
    />
  );
}
