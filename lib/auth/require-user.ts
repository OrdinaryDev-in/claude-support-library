import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Plain server-only module — deliberately NOT "use server". In a "use
// server" file every top-level exported async function is treated by
// Next.js as a callable Server Action, which these two helpers must not
// become: requireUser() is an internal guard, and isAuthorOrAdmin() takes
// a non-serializable SupabaseClient argument. Keeping them here (instead
// of inline in app/actions/prompts.ts) also makes them unit-testable
// without pulling in the Server Actions machinery.

/** Redirects to /login if there's no signed-in user; otherwise returns
 * the server Supabase client alongside the user. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** True if `userId` is the prompt's author, or has the admin role. */
export async function isAuthorOrAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  authorId: string
) {
  if (userId === authorId) return true;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role === "admin";
}
