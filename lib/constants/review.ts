import type { PromptStatus, SkillStatus, ConnectorStatus } from "@/lib/types/database.types";

export interface StatusMeta {
  label: string;
  /** CSS var name defined in app/globals.css — matches the category legend's convention. */
  color: string;
}

// Single source of truth for how a review status renders — shared by
// StatusPill (author-facing: PromptDetail/account) and the admin review
// queue, so the two surfaces never drift.
export const PROMPT_STATUS_META: Record<PromptStatus, StatusMeta> = {
  pending_review: { label: "Pending Review", color: "var(--brass)" },
  approved: { label: "Approved", color: "var(--teal)" },
  rejected: { label: "Rejected", color: "var(--danger)" },
};

// Same three values as PROMPT_STATUS_META today, but a separate map since
// skill_status (20260824140000_skills.sql) is its own Postgres enum, not a
// reuse of prompt_status — see StatusPill's own comment.
export const SKILL_STATUS_META: Record<SkillStatus, StatusMeta> = {
  pending_review: { label: "Pending Review", color: "var(--brass)" },
  approved: { label: "Approved", color: "var(--teal)" },
  rejected: { label: "Rejected", color: "var(--danger)" },
};

// Same three values again, own map — connector_status
// (20260824150000_connectors.sql) is its own Postgres enum too.
export const CONNECTOR_STATUS_META: Record<ConnectorStatus, StatusMeta> = {
  pending_review: { label: "Pending Review", color: "var(--brass)" },
  approved: { label: "Approved", color: "var(--teal)" },
  rejected: { label: "Rejected", color: "var(--danger)" },
};
