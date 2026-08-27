import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/data/categories";
import { PromptForm } from "@/components/prompts/PromptForm";

export default async function NewPromptPage() {
  // /library is guest-readable (proxy.ts), so a guest's anonymous session
  // reaches this route too — bounce to /signup before rendering the form
  // rather than letting them fill it out only to be redirected on submit
  // (createPrompt()'s own requireUser() would reject it there either way).
  if ((await headers()).get("x-is-guest") === "1") redirect("/signup");

  const supabase = await createClient();
  const categories = await listCategories(supabase, "prompt");

  // Best-effort — proxy.ts's auth gate already requires a session to reach
  // this route at all; a missing header just means the inline "+ New
  // category" control (admin-only) stays hidden, same as any other
  // admin-only affordance when the role lookup can't be resolved.
  const userId = (await headers()).get("x-user-id");
  let isAdmin = false;
  if (userId) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    isAdmin = profile?.role === "admin";
  }

  return <PromptForm mode="create" categories={categories} isAdmin={isAdmin} />;
}
