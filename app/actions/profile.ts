"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeActionError } from "@/lib/errors";

/** Called right after a session is established (password login or the
 * OAuth/email-confirm callback) so `profiles.last_login_at` stays current. */
export async function touchLastLogin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", user.id);
}

export async function updateFullName(
  fullName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // A guest's anonymous session (lib/supabase/middleware.ts) satisfies
  // `user` truthy but has no account to edit — /signup, not /login.
  if (!user || user.is_anonymous) redirect("/signup");

  const trimmed = fullName.trim();
  if (!trimmed) return { ok: false, error: "Full name can't be empty." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: trimmed })
    .eq("id", user.id);

  if (error) return { ok: false, error: safeActionError("updateFullName", error, "Could not save your name.") };

  revalidatePath("/account");
  return { ok: true };
}

export async function updatePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!currentPassword || !newPassword || !confirmPassword) {
    return { ok: false, error: "All fields are required." };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: "New password and confirmation do not match." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  // Re-authenticate with the current password before allowing the change.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: safeActionError("updatePassword", error, "Could not update your password.") };

  return { ok: true };
}
