import Link from "next/link";
import { LIBRARY_SECTIONS, type LibrarySection } from "@/lib/constants/library-sections";

function volumeStatus(section: LibrarySection, promptsCharted: number) {
  if (!section.enabled) return "uncharted";
  return `${promptsCharted} charted →`;
}

export function LibraryHub({ promptsCharted }: { promptsCharted: number }) {
  return (
    <div className="flex-1 w-full mx-auto max-w-[1180px] px-4 sm:px-8 py-10 sm:py-16 pb-24">
      <div className="font-[family-name:var(--font-mono)] text-xs tracking-wider text-[var(--brass)] uppercase mb-3">
        DevAtlas
      </div>
      <h1 className="font-[family-name:var(--font-display)] font-medium text-[30px] sm:text-[44px] mb-2 text-[var(--text)]">
        The Library
      </h1>
      <p className="text-sm sm:text-base text-[var(--muted)] max-w-[520px] mb-10 sm:mb-16">
        Structured, elaborate prompt templates and reference material for
        building fast and correctly — organized as a growing set of volumes.
      </p>

      {/* Desktop: three volumes side by side, joined by the route line */}
      <div className="hidden md:grid relative grid-cols-3 gap-8 items-start">
        <div
          className="absolute left-0 right-0 h-0 z-0"
          style={{ top: 52, borderTop: "2px dotted rgba(232,163,61,0.35)" }}
        />
        {LIBRARY_SECTIONS.map((section, i) => (
          <VolumeCardDesktop
            key={section.key}
            section={section}
            status={volumeStatus(section, promptsCharted)}
            delay={i * 0.08}
          />
        ))}
      </div>

      {/* Mobile: vertical timeline of volumes */}
      <div className="md:hidden relative flex flex-col gap-6">
        <div
          className="absolute top-0 bottom-0 left-[19px] w-0 z-0"
          style={{ borderLeft: "2px dotted rgba(232,163,61,0.35)" }}
        />
        {LIBRARY_SECTIONS.map((section) => (
          <VolumeRowMobile
            key={section.key}
            section={section}
            status={volumeStatus(section, promptsCharted)}
          />
        ))}
      </div>
    </div>
  );
}

function VolumeCardDesktop({
  section,
  status,
  delay,
}: {
  section: LibrarySection;
  status: string;
  delay: number;
}) {
  const inner = (
    <div
      className={
        "relative z-10 rounded-lg p-6 h-[220px] flex flex-col justify-between transition-transform duration-150 " +
        (section.enabled
          ? "bg-[var(--surface)] border border-[var(--brass)] hover:-translate-y-[3px]"
          : "border border-dashed border-[var(--border)] cursor-not-allowed")
      }
      style={
        section.enabled
          ? undefined
          : {
              backgroundImage:
                "repeating-linear-gradient(135deg, var(--surface) 0px, var(--surface) 8px, var(--surface-2) 8px, var(--surface-2) 9px)",
            }
      }
    >
      <div>
        <h2
          className={
            "font-[family-name:var(--font-display)] font-medium text-[22px] mb-2 " +
            (section.enabled ? "text-[var(--text)]" : "text-[var(--muted)]")
          }
        >
          {section.label}
        </h2>
        <p
          className={
            "text-[13px] leading-relaxed " +
            (section.enabled ? "text-[var(--muted)]" : "text-[var(--muted)] opacity-70")
          }
        >
          {section.description}
        </p>
      </div>
      <div
        className="font-[family-name:var(--font-mono)] text-xs"
        style={{ color: section.enabled ? "var(--teal)" : "var(--muted)" }}
      >
        {status}
      </div>
    </div>
  );

  return (
    <div
      className="relative z-10 opacity-0"
      style={{ animation: `riseIn 0.5s ease-out ${delay}s both` }}
    >
      <div className="font-[family-name:var(--font-mono)] text-[11px] tracking-wider text-[var(--muted)] mb-2.5">
        VOLUME {section.volume}
      </div>
      {section.enabled ? (
        <Link href={section.href} className="block no-underline">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

function VolumeRowMobile({
  section,
  status,
}: {
  section: LibrarySection;
  status: string;
}) {
  const node = (
    <div
      className={
        "w-[38px] h-[38px] shrink-0 rounded-full bg-[var(--ink)] relative z-10 " +
        (section.enabled ? "border border-[var(--brass)]" : "border border-dashed border-[var(--border)]")
      }
    />
  );

  const card = (
    <div
      className={
        "flex-1 rounded-lg p-[18px] relative z-10 " +
        (section.enabled
          ? "bg-[var(--surface)] border border-[var(--brass)]"
          : "bg-[var(--surface-2)] border border-dashed border-[var(--border)]")
      }
    >
      <div className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--muted)] mb-1.5">
        VOLUME {section.volume}
      </div>
      <h2
        className={
          "font-[family-name:var(--font-display)] font-medium text-lg mb-1.5 " +
          (section.enabled ? "text-[var(--text)]" : "text-[var(--muted)]")
        }
      >
        {section.label}
      </h2>
      <div
        className="font-[family-name:var(--font-mono)] text-[11px]"
        style={{ color: section.enabled ? "var(--teal)" : "var(--muted)" }}
      >
        {status}
      </div>
    </div>
  );

  if (section.enabled) {
    return (
      <Link href={section.href} className="relative z-10 flex gap-3.5 no-underline">
        {node}
        {card}
      </Link>
    );
  }
  return (
    <div className="relative z-10 flex gap-3.5">
      {node}
      {card}
    </div>
  );
}
