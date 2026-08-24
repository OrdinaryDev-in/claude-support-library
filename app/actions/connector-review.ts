"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeActionError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";

export type ConnectorReviewActionResult = { ok: true } | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Same shape as app/actions/{review,skill-review}.ts's rate limit.
const REVIEW_ACTION_RATE_LIMIT = { max: 30, windowMs: 60_000 };

/** Duplicated from app/actions/review.ts's requireAdmin, same reasoning as
 * app/actions/skill-review.ts's copy — own error-message wording, same
 * size class as the other small per-resource helpers already duplicated
 * in this codebase. RLS (connectors_update_owner_or_admin,
 * 20260824150000_connectors.sql) is the actual backstop. */
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
    return { ok: false, error: "You don't have permission to review connectors." };
  }
  if (!checkRateLimit(`connector-review-action:${user.id}`, REVIEW_ACTION_RATE_LIMIT).allowed) {
    return { ok: false, error: "Too many actions — please wait a minute and try again." };
  }
  return { ok: true, supabase, user };
}

function revalidateReviewPaths(slug?: string) {
  revalidatePath("/admin/review/connectors");
  revalidatePath("/library/connectors");
  if (slug) revalidatePath(`/library/connectors/${slug}`);
}

export async function approveConnector(connectorId: string): Promise<ConnectorReviewActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { supabase } = admin;

  const { data, error } = await supabase
    .from("connectors")
    .update({ status: "approved", rejection_reason: null })
    .eq("id", connectorId)
    .select("slug")
    .single();

  if (error || !data) {
    return { ok: false, error: safeActionError("approveConnector", error, "Could not approve this connector.") };
  }

  revalidateReviewPaths(data.slug);
  return { ok: true };
}

const rejectSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required.").max(500, "Keep the reason under 500 characters."),
});

export async function rejectConnector(connectorId: string, reason: string): Promise<ConnectorReviewActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { supabase } = admin;

  const parsed = rejectSchema.safeParse({ reason });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "A reason is required." };
  }

  const { data, error } = await supabase
    .from("connectors")
    .update({ status: "rejected", rejection_reason: parsed.data.reason })
    .eq("id", connectorId)
    .select("slug")
    .single();

  if (error || !data) {
    return { ok: false, error: safeActionError("rejectConnector", error, "Could not reject this connector.") };
  }

  revalidateReviewPaths(data.slug);
  return { ok: true };
}
