"use client";

import { createLibraryCountContext } from "@/components/library/LibraryCountContext";

// The Prompts instantiation of the generic factory (Phase 2, Part 2) — same
// Provider/hook names/exports as before this refactor, so every existing
// consumer (app/(app)/library/prompts/page.tsx, PromptsGrid, LoadedCount)
// is unaffected. A future Skills page calls createLibraryCountContext()
// again for its own Provider/hook pair rather than reusing this one.
const { Provider: PromptsCountProvider, useCount: usePromptsCount } = createLibraryCountContext();

export { PromptsCountProvider, usePromptsCount };
