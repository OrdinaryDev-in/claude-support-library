import Link from "next/link";

/** Generic library-grid card shape — any resource type (Prompts today,
 * Skills/Connectors later) maps its row to this at render time via a small
 * adapter function, rather than LibraryCard knowing about any one
 * resource's fields directly. See components/library/PromptsGrid.tsx's
 * `promptToCardItem` for the Prompts adapter. */
export interface LibraryCardItem {
  href: string;
  title: string;
  description: string;
  tags: string[];
  category: { label: string; color: string };
  /** Footer meta text after the category label, e.g. "42 uses". */
  meta?: string;
}

export function LibraryCard({ item }: { item: LibraryCardItem }) {
  return (
    <Link
      href={item.href}
      className="group no-underline text-inherit bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 flex flex-col gap-2.5 transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--brass)_40%,transparent)]"
    >
      <div
        className="flex items-center gap-1.5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide"
        style={{ color: item.category.color }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: item.category.color }} />
        {item.category.label}
      </div>
      <h3 className="text-base font-semibold m-0 text-[var(--text)]">{item.title}</h3>
      <p className="text-[13px] text-[var(--muted)] m-0 leading-relaxed flex-1">{item.description}</p>
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
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
        § {item.category.label}
        {item.meta ? ` · ${item.meta}` : ""}
      </div>
    </Link>
  );
}
