import type { PromptCategory } from "@/lib/types/database.types";

export interface CategoryMeta {
  key: PromptCategory;
  label: string;
  /** legend-swatch color — CSS var name defined in app/globals.css */
  color: string;
}

// Colors match the category legend swatches used throughout the design
// screens (Browse/Detail/Form) — kept as a single source of truth here.
export const PROMPT_CATEGORIES: CategoryMeta[] = [
  { key: "new_app", label: "New App", color: "var(--cat-new-app)" },
  { key: "module_feature", label: "Module / Feature", color: "var(--cat-module-feature)" },
  { key: "debugging", label: "Debugging", color: "var(--cat-debugging)" },
  { key: "frontend", label: "Frontend", color: "var(--cat-frontend)" },
  { key: "backend", label: "Backend", color: "var(--cat-backend)" },
];

export function categoryMeta(key: PromptCategory): CategoryMeta {
  return PROMPT_CATEGORIES.find((c) => c.key === key) ?? PROMPT_CATEGORIES[0];
}
