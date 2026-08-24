"use client";

import { createLibraryCountContext } from "@/components/library/LibraryCountContext";

// The Connectors instantiation of the generic factory — mirrors
// PromptsCountContext.tsx / SkillsCountContext.tsx.
const { Provider: ConnectorsCountProvider, useCount: useConnectorsCount } = createLibraryCountContext();

export { ConnectorsCountProvider, useConnectorsCount };
