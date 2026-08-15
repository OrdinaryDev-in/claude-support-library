"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** Shares the "how many prompts are loaded so far" number between the
 * header's "X of Y charted" line and PromptsGrid, which live in different
 * parts of the page layout (header row vs. main content) so can't just
 * pass the count as a normal prop down one tree. PromptsGrid owns the
 * actual list and pushes its length in here as pages load; the header
 * only reads it. */
const PromptsCountContext = createContext<{
  count: number;
  setCount: (n: number) => void;
} | null>(null);

export function PromptsCountProvider({
  initialCount,
  children,
}: {
  initialCount: number;
  children: ReactNode;
}) {
  const [count, setCount] = useState(initialCount);
  return (
    <PromptsCountContext.Provider value={{ count, setCount }}>
      {children}
    </PromptsCountContext.Provider>
  );
}

export function usePromptsCount() {
  const ctx = useContext(PromptsCountContext);
  if (!ctx) {
    throw new Error("usePromptsCount must be used within a PromptsCountProvider");
  }
  return ctx;
}
