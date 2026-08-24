"use client";

import { loadMoreSkills } from "@/app/actions/skills";
import { SKILLS_PAGE_SIZE, type SkillListFilters, type SkillWithTags } from "@/lib/data/skills";
import { categoryDisplay } from "@/lib/data/categories";
import { LibraryList } from "@/components/library/LibraryList";
import { LibraryCard, type LibraryCardItem } from "@/components/library/LibraryCard";
import { PromptCardSkeleton } from "@/components/ui/Skeleton";
import { useSkillsCount } from "@/components/library/SkillsCountContext";

/** Adapter from a skill row to the generic LibraryCard shape — mirrors
 * components/library/PromptsGrid.tsx's promptToCardItem. */
function skillToCardItem(skill: SkillWithTags): LibraryCardItem {
  const cat = categoryDisplay(skill.categories);
  return {
    href: `/library/skills/${skill.slug}`,
    title: skill.title,
    description: skill.description,
    tags: skill.tags,
    category: { label: cat.label, color: cat.color },
    meta: `${skill.view_count} uses`,
  };
}

/** The Skills instantiation of LibraryList — mirrors
 * components/library/PromptsGrid.tsx. Give it `key={filterKey}` from the
 * parent so a filter/search change remounts it with a fresh offset. */
export function SkillsGrid({
  initialSkills,
  filters,
}: {
  initialSkills: SkillWithTags[];
  filters: SkillListFilters;
}) {
  const { setCount } = useSkillsCount();

  return (
    <LibraryList
      initialItems={initialSkills}
      pageSize={SKILLS_PAGE_SIZE}
      loadMore={async (offset) => {
        const { skills } = await loadMoreSkills(filters, offset);
        return skills;
      }}
      getKey={(skill) => skill.id}
      renderItem={(skill) => <LibraryCard item={skillToCardItem(skill)} />}
      renderSkeleton={() => <PromptCardSkeleton />}
      onCountChange={setCount}
      renderEndMessage={(count) => `§ end of volume — ${count} charted`}
    />
  );
}
