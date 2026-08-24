"use client";

import { loadMoreConnectors } from "@/app/actions/connectors";
import { CONNECTORS_PAGE_SIZE, type ConnectorListFilters, type ConnectorWithTags } from "@/lib/data/connectors";
import { categoryDisplay } from "@/lib/data/categories";
import { LibraryList } from "@/components/library/LibraryList";
import { LibraryCard, type LibraryCardItem } from "@/components/library/LibraryCard";
import { PromptCardSkeleton } from "@/components/ui/Skeleton";
import { useConnectorsCount } from "@/components/library/ConnectorsCountContext";

/** Adapter from a connector row to the generic LibraryCard shape — mirrors
 * components/library/{PromptsGrid,SkillsGrid}.tsx. */
function connectorToCardItem(connector: ConnectorWithTags): LibraryCardItem {
  const cat = categoryDisplay(connector.categories);
  return {
    href: `/library/connectors/${connector.slug}`,
    title: connector.title,
    description: connector.description,
    tags: connector.tags,
    category: { label: cat.label, color: cat.color },
    meta: `${connector.view_count} uses`,
  };
}

/** The Connectors instantiation of LibraryList — mirrors
 * components/library/{PromptsGrid,SkillsGrid}.tsx. */
export function ConnectorsGrid({
  initialConnectors,
  filters,
}: {
  initialConnectors: ConnectorWithTags[];
  filters: ConnectorListFilters;
}) {
  const { setCount } = useConnectorsCount();

  return (
    <LibraryList
      initialItems={initialConnectors}
      pageSize={CONNECTORS_PAGE_SIZE}
      loadMore={async (offset) => {
        const { connectors } = await loadMoreConnectors(filters, offset);
        return connectors;
      }}
      getKey={(connector) => connector.id}
      renderItem={(connector) => <LibraryCard item={connectorToCardItem(connector)} />}
      renderSkeleton={() => <PromptCardSkeleton />}
      onCountChange={setCount}
      renderEndMessage={(count) => `§ end of volume — ${count} charted`}
    />
  );
}
