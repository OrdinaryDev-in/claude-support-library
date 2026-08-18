"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeActionError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

export type ReviewActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Shared bucket across approve/reject, keyed by admin user id. More
// generous than prompt writes (app/actions/prompts.ts) — an admin
// working through a real review queue can legitimately approve/reject
// many rows in quick succession.
const REVIEW_ACTION_RATE_LIMIT = { max: 30, windowMs: 60_000 };

/** App-level check for a clean error message — RLS (prompts_update_owner_or_admin,
 * supabase/migrations/0002_rls.sql) is the actual backstop a non-admin can't
 * bypass even if this check were skipped. Mirrors isAuthorOrAdmin's
 * error-return style in app/actions/prompts.ts rather than redirecting, since
 * this only gates review actions on a page a non-admin shouldn't be on in the
 * first place. */
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
    return { ok: false, error: "You don't have permission to review prompts." };
  }
  if (!checkRateLimit(`review-action:${user.id}`, REVIEW_ACTION_RATE_LIMIT).allowed) {
    return { ok: false, error: "Too many actions — please wait a minute and try again." };
  }
  return { ok: true, supabase, user };
}

function revalidateReviewPaths(slug?: string) {
  revalidatePath("/admin/review");
  revalidatePath("/library/prompts");
  if (slug) revalidatePath(`/library/prompts/${slug}`);
}

export async function approvePrompt(promptId: string): Promise<ReviewActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { supabase } = admin;

  // reviewed_by/reviewed_at are stamped automatically by
  // guard_prompt_review_state() (0009_prompt_review_workflow.sql) — it
  // reads the caller's own auth.uid(), which an app-level UPDATE payload
  // can't spoof on another admin's behalf.
  const { data, error } = await supabase
    .from("prompts")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", promptId)
    .select("slug")
    .single();

  if (error || !data) {
    return { ok: false, error: safeActionError("approvePrompt", error, "Could not approve this prompt.") };
  }

  revalidateReviewPaths(data.slug);
  return { ok: true };
}

const rejectSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required.").max(500, "Keep the reason under 500 characters."),
});

export async function rejectPrompt(promptId: string, reason: string): Promise<ReviewActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { supabase } = admin;

  const parsed = rejectSchema.safeParse({ reason });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const { data, error } = await supabase
    .from("prompts")
    .update({ status: "rejected", rejection_reason: parsed.data.reason })
    .eq("id", promptId)
    .select("slug")
    .single();

  if (error || !data) {
    return { ok: false, error: safeActionError("rejectPrompt", error, "Could not reject this prompt.") };
  }

  revalidateReviewPaths(data.slug);
  return { ok: true };
}
