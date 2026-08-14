"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PROMPT_CATEGORIES } from "@/lib/constants/categories/prompts";
import type { PromptCategory } from "@/lib/types/database.types";

export function LibraryFilters({
  counts,
  tags,
}: {
  counts: Record<PromptCategory, number>;
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeCategory = searchParams.get("category") as PromptCategory | null;
  const activeTags = (searchParams.get("tags") || "").split(",").filter(Boolean);
  const hasFilters = Boolean(activeCategory) || activeTags.length > 0 || Boolean(searchParams.get("q"));

  function push(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleCategory(key: PromptCategory) {
    const params = new URLSearchParams(searchParams.toString());
    if (activeCategory === key) params.delete("category");
    else params.set("category", key);
    push(params);
  }

  function toggleTag(tag: string) {
    const params = new URLSearchParams(searchParams.toString());
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    if (next.length > 0) params.set("tags", next.join(","));
    else params.delete("tags");
    push(params);
  }

  function clearFilters() {
    router.push(pathname);
  }

  const content = (
    <>
      <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-[var(--muted)] uppercase mb-3">
        Legend
      </div>
      <div className="flex flex-col">
        {PROMPT_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => toggleCategory(cat.key)}
            className={
              "flex items-center gap-2 py-1.5 text-left rounded-sm transition-colors " +
              (activeCategory === cat.key ? "text-[var(--text)]" : "text-[var(--text)]/90 hover:text-[var(--text)]")
            }
            aria-pressed={activeCategory === cat.key}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                background: cat.color,
                boxShadow: activeCategory === cat.key ? `0 0 0 3px color-mix(in srgb, ${cat.color} 25%, transparent)` : undefined,
              }}
            />
            <span className="flex-1 text-[13px]">{cat.label}</span>
            <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--muted)]">
              {counts[cat.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="h-px bg-[var(--border)] my-4" />

      <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-[var(--muted)] uppercase mb-3">
        Tags
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const active = activeTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              aria-pressed={active}
              className="font-[family-name:var(--font-mono)] text-[11px] px-2 py-1 rounded-[5px] border transition-colors"
              style={{
                borderColor: active ? "var(--brass)" : "var(--border)",
                color: active ? "var(--brass)" : "var(--muted)",
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {hasFilters && (
        <button
          onClick={clearFilters}
          className="inline-block mt-5 text-xs text-[var(--brass)] hover:underline"
        >
          Clear filters
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden md:block w-[220px] shrink-0">{content}</aside>

      {/* Mobile collapsible panel */}
      <div className="md:hidden mb-5">
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="flex items-center gap-2 text-[13px] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-2"
          aria-expanded={mobileOpen}
        >
          Filters{hasFilters ? " ·" : ""}
          {activeCategory && (
            <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--brass)]">
              {PROMPT_CATEGORIES.find((c) => c.key === activeCategory)?.label}
            </span>
          )}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={mobileOpen ? "rotate-180 transition-transform" : "transition-transform"}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {mobileOpen && (
          <div className="mt-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
            {content}
          </div>
        )}
      </div>
    </>
  );
}
