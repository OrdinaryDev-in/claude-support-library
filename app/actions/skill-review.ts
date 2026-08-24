"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeActionError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

export type SkillReviewActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Same shape as app/actions/review.ts's REVIEW_ACTION_RATE_LIMIT, a
// separate bucket per resource type.
const REVIEW_ACTION_RATE_LIMIT = { max: 30, windowMs: 60_000 };

/** Duplicated from app/actions/review.ts's requireAdmin rather than
 * shared — same ~15-line size class as syncTags/uniqueSlug (see
 * app/actions/skills.ts), and sharing would mean either a generic error
 * message or leaking "skills" wording into the Prompts review flow. RLS
 * (skills_update_owner_or_admin, 20260824140000_skills.sql) is the actual
 * backstop a non-admin can't bypass even if this check were skipped. */
async function requireAdmin(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string } }
  | { ok: false; error: string }
> {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { ok: false, error: "You don't have permission to review skills." };
  }
  if (!checkRateLimit(`skill-review-action:${user.id}`, REVIEW_ACTION_RATE_LIMIT).allowed) {
    return { ok: false, error: "Too many actions — please wait a minute and try again." };
  }
  return { ok: true, supabase, user };
}

function revalidateReviewPaths(slug?: string) {
  revalidatePath("/admin/review/skills");
  revalidatePath("/library/skills");
  if (slug) revalidatePath(`/library/skills/${slug}`);
}

export async function approveSkill(skillId: string): Promise<SkillReviewActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { supabase } = admin;

  // reviewed_by/reviewed_at are stamped automatically by
  // guard_skill_review_state() (20260824140000_skills.sql) — it reads the
  // caller's own auth.uid(), which an app-level UPDATE payload can't spoof
  // on another admin's behalf.
  const { data, error } = await supabase
    .from("skills")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", skillId)
    .select("slug")
    .single();

  if (error || !data) {
    return { ok: false, error: safeActionError("approveSkill", error, "Could not approve this skill.") };
  }

  revalidateReviewPaths(data.slug);
  return { ok: true };
}

const rejectSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required.").max(500, "Keep the reason under 500 characters."),
});

export async function rejectSkill(skillId: string, reason: string): Promise<SkillReviewActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { supabase } = admin;

  const parsed = rejectSchema.safeParse({ reason });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const { data, error } = await supabase
    .from("skills")
    .update({ status: "rejected", rejection_reason: parsed.data.reason })
    .eq("id", skillId)
    .select("slug")
    .single();

  if (error || !data) {
    return { ok: false, error: safeActionError("rejectSkill", error, "Could not reject this skill.") };
  }

  revalidateReviewPaths(data.slug);
  return { ok: true };
}
