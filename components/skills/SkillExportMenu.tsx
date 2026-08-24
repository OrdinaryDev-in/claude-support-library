"use client";

import { useRef } from "react";
import { toClaudeSkillMd, toGenericMarkdown, type ExportableSkill } from "@/lib/validation/skill-export";

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export a skill in the format a given AI agent actually reads.
 *
 * Claude Code has a real, distinct skill-file format (SKILL.md — YAML
 * frontmatter + a markdown body, installable under ~/.claude/skills/).
 * Codex, a custom GPT's Instructions field, and most other agents don't
 * have an equivalent structured format of their own — they just take
 * plain instruction text — so this deliberately offers two options, not
 * one-per-agent-name: a real Claude Code export, and a generic Markdown
 * export that works anywhere plain instructions are accepted. Pretending
 * every agent has its own distinct file format would just be wrong. */
export function SkillExportMenu({ skill }: { skill: ExportableSkill & { description: string } }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  function handleExport(fn: () => void) {
    fn();
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <details ref={detailsRef} className="relative inline-block">
      <summary className="cursor-pointer list-none marker:content-none px-3.5 py-2 rounded-md border border-[var(--border)] text-[var(--text)] text-[13px] inline-flex items-center gap-1.5">
        Export
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div
        role="menu"
        className="absolute right-0 mt-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-md shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-20 min-w-[240px] py-1"
      >
        <button
          role="menuitem"
          onClick={() => handleExport(() => download(`${skill.slug}.SKILL.md`, toClaudeSkillMd(skill)))}
          className="w-full text-left px-3.5 py-2.5 text-[13px] text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
        >
          <div className="font-semibold">Claude Code</div>
          <div className="text-[11px] text-[var(--muted)] font-[family-name:var(--font-mono)]">SKILL.md — installable as-is</div>
        </button>
        <button
          role="menuitem"
          onClick={() => handleExport(() => download(`${skill.slug}.md`, toGenericMarkdown(skill)))}
          className="w-full text-left px-3.5 py-2.5 text-[13px] text-[var(--text)] hover:bg-[var(--surface)] transition-colors"
        >
          <div className="font-semibold">Codex, GPT, other agents</div>
          <div className="text-[11px] text-[var(--muted)] font-[family-name:var(--font-mono)]">Plain Markdown — paste as instructions</div>
        </button>
      </div>
    </details>
  );
}
