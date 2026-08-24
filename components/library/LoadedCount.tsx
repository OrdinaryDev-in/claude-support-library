"use client";

/** Generic over which resource-type count context it reads from — pass the
 * `useCount` hook returned by that type's createLibraryCountContext()
 * instantiation (usePromptsCount, useSkillsCount, ...). */
export function LoadedCount({ total, useCount }: { total: number; useCount: () => { count: number } }) {
  const { count } = useCount();
  return (
    <>
      {count} of {total} charted
    </>
  );
}
