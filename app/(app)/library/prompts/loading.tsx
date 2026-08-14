import { PromptGridSkeleton } from "@/components/ui/Skeleton";

export default function BrowsePromptsLoading() {
  return (
    <div className="flex-1 w-full mx-auto max-w-[1180px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
      <div className="mb-6 sm:mb-9">
        <h1 className="font-[family-name:var(--font-display)] font-medium text-[26px] sm:text-[30px] mb-1">
          Prompts
        </h1>
        <div className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
          § VOLUME I · loading…
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-6 md:gap-10">
        <div className="hidden md:block w-[220px] shrink-0" />
        <main className="flex-1 min-w-0">
          <PromptGridSkeleton />
        </main>
      </div>
    </div>
  );
}
