"use client";

import { createLibraryCountContext } from "@/components/library/LibraryCountContext";

// The Skills instantiation of the generic factory — mirrors
// PromptsCountContext.tsx.
const { Provider: SkillsCountProvider, useCount: useSkillsCount } = createLibraryCountContext();

export { SkillsCountProvider, useSkillsCount };
