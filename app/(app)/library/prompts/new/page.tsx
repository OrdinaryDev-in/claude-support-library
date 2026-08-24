import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/data/categories";
import { PromptForm } from "@/components/prompts/PromptForm";

export default async function NewPromptPage() {
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
