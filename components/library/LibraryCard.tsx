import Link from "next/link";
import type { PromptWithTags } from "@/lib/data/prompts";
import { categoryMeta } from "@/lib/constants/categories/prompts";

export function LibraryCard({ prompt }: { prompt: PromptWithTags }) {
  const cat = categoryMeta(prompt.category);

  return (
    <Link
      href={`/library/prompts/${prompt.slug}`}
      className="group no-underline text-inherit bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 flex flex-col gap-2.5 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--brass)_40%,transparent)]"
    >
      <div
        className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide"
        style={{ color: cat.color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
        {cat.label}
      </div>
      <h3 className="text-base font-semibold m-0 text-[var(--text)]">{prompt.title}</h3>
      <p className="text-[13px] text-[var(--muted)] m-0 leading-relaxed flex-1">
        {prompt.description}
      </p>
      {prompt.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {prompt.tags.map((tag) => (
            <span
              key={tag}
              className="font-[family-name:var(--font-mono)] text-[10px] px-1.5 py-0.5 border border-[var(--border)] rounded text-[var(--muted)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--muted)] border-t border-[var(--border)] pt-2.5">
        § {cat.label} · {prompt.view_count} uses
      </div>
    </Link>
  );
}
