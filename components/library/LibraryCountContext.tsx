"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** Factory extracted from the old components/library/PromptsCountContext.tsx
 * (Phase 2, Part 2) — shares "how many items are loaded so far" between a
 * page's header ("X of Y charted" line) and its LibraryList instance, which
 * live in different parts of the page layout so can't just pass the count
 * as a normal prop down one tree. Each resource type calls this once to get
 * its own typed Provider/hook pair, instead of copy-pasting the
 * createContext/useState/useContext boilerplate — see
 * PromptsCountContext.tsx for the Prompts instantiation. */
export function createLibraryCountContext() {
  const Context = createContext<{
    count: number;
    setCount: (n: number) => void;
  } | null>(null);

  function Provider({ initialCount, children }: { initialCount: number; children: ReactNode }) {
    const [count, setCount] = useState(initialCount);
    return <Context.Provider value={{ count, setCount }}>{children}</Context.Provider>;
  }

  function useCount() {
    const ctx = useContext(Context);
    if (!ctx) {
      throw new Error("useCount must be used within its matching Provider");
    }
    return ctx;
  }

  return { Provider, useCount };
}
