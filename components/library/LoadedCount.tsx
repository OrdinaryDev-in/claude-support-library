"use client";

import { usePromptsCount } from "@/components/library/PromptsCountContext";

export function LoadedCount({ total }: { total: number }) {
  const { count } = usePromptsCount();
  return (
    <>
      {count} of {total} charted
    </>
  );
}
