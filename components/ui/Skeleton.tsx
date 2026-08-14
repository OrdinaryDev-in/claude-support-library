function Bar({ width, height, mb }: { width: string; height: number; mb?: number }) {
  return (
    <div
      className="rounded"
      style={{
        width,
        height,
        marginBottom: mb,
        background: "linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)",
        backgroundSize: "200px 100%",
        animation: "shimmer 1.4s infinite",
      }}
    />
  );
}

export function PromptCardSkeleton() {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 h-[168px]">
      <Bar width="60%" height={10} mb={16} />
      <Bar width="85%" height={16} mb={10} />
      <Bar width="95%" height={10} mb={6} />
      <Bar width="70%" height={10} />
    </div>
  );
}

export function PromptGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <PromptCardSkeleton key={i} />
      ))}
    </div>
  );
}
