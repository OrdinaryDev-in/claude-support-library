"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeActionError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { categorySchema, type CategoryFormValues } from "@/lib/validation/category-schema";
import type { CategoryDisplay } from "@/lib/data/categories";

export type CategoryActionResult = { ok: true } | { ok: false; error: string };
export type CreateCategoryResult =
  | { ok: true; category: CategoryDisplay & { id: string } }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// Same shape as review.ts's requireAdmin — categories are admin-only
// writes (unlike tags, which any signed-in user can create), gated the
// same way review actions are. RLS (categories_insert_admin/_update_admin/
// _delete_admin, 20260824130000_categories.sql) is the actual backstop; this
// app-level check just gives a clean error message to the inline
// "+ New category" control in PromptForm, which only renders for an admin
// in the first place.
const CATEGORY_WRITE_RATE_LIMIT = { max: 30, windowMs: 60_000 };

async function requireAdmin(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { ok: false, error: "You don't have permission to manage categories." };
  }
  if (!checkRateLimit(`category-write:${user.id}`, CATEGORY_WRITE_RATE_LIMIT).allowed) {
    return { ok: false, error: "Too many actions — please wait a minute and try again." };
  }
  return { ok: true, supabase };
}

function revalidateCategoryPaths() {
  // No dedicated admin page for this (categories live inline in
  // PromptForm) — revalidate the surfaces that actually render categories.
  revalidatePath("/library/prompts");
  revalidatePath("/library/prompts/new");
}

export async function createCategory(values: CategoryFormValues): Promise<CreateCategoryResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { supabase } = admin;

  const parsed = categorySchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  // Selected back so the caller (e.g. PromptForm's inline "+ New category")
  // can immediately select the new category without a full page reload.
  const { data, error } = await supabase
    .from("categories")
    .insert(parsed.data)
    .select("id, key, label, color")
    .single();
  if (error || !data) {
    // A duplicate (resource_type, key) pair hits the categories table's
    // unique constraint — the one Postgres error worth a specific message
    // here since it's directly actionable ("pick a different key"),
    // everything else stays generic per safeActionError's contract.
    if (error?.code === "23505") {
      return { ok: false, error: "A category with this key already exists for this resource type." };
    }
    return { ok: false, error: safeActionError("createCategory", error, "Could not create this category.") };
  }

  revalidateCategoryPaths();
  return { ok: true, category: data };
}

export async function updateCategory(
  id: string,
  values: Pick<CategoryFormValues, "label" | "color" | "sort_order">
): Promise<CategoryActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { supabase } = admin;

  const parsed = categorySchema.pick({ label: true, color: true, sort_order: true }).safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const { error } = await supabase.from("categories").update(parsed.data).eq("id", id);
  if (error) {
    return { ok: false, error: safeActionError("updateCategory", error, "Could not update this category.") };
  }

  revalidateCategoryPaths();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<CategoryActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  const { supabase } = admin;

  // Prompts' category_id has no ON DELETE behavior beyond the default
  // RESTRICT, so deleting a category still in use fails cleanly at the DB
  // level (foreign_key_violation) rather than silently orphaning rows —
  // surfaced here as an actionable message instead of the generic fallback.
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "This category is still in use — reassign or remove those items first." };
    }
    return { ok: false, error: safeActionError("deleteCategory", error, "Could not delete this category.") };
  }

  revalidateCategoryPaths();
  return { ok: true };
}
