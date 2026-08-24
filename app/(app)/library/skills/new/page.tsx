import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/data/categories";
import { SkillForm } from "@/components/skills/SkillForm";

// Mirrors app/(app)/library/prompts/new/page.tsx.
export default async function NewSkillPage() {
  const supabase = await createClient();
  const categories = await listCategories(supabase, "skill");

  const userId = (await headers()).get("x-user-id");
  let isAdmin = false;
  if (userId) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    isAdmin = profile?.role === "admin";
  }

  return <SkillForm mode="create" categories={categories} isAdmin={isAdmin} />;
}
