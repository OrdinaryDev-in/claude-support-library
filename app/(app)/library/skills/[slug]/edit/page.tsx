import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/data/categories";
import { SkillForm, type SkillFormInitialValues } from "@/components/skills/SkillForm";

// Mirrors app/(app)/library/prompts/[slug]/edit/page.tsx.
export default async function EditSkillPage({ params }: PageProps<"/library/skills/[slug]/edit">) {
  const { slug } = await params;

  const userId = (await headers()).get("x-user-id");
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: skill, error } = await supabase.from("skills").select("*").eq("slug", slug).single();
  if (error || !skill) notFound();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  const isAdmin = profile?.role === "admin";

  const allowed = userId === skill.author_id || isAdmin;
  if (!allowed) redirect(`/library/skills/${skill.slug}`);

  const { data: joins } = await supabase.from("skill_tags").select("tags(name)").eq("skill_id", skill.id);
  const tagsInput = (joins ?? [])
    .map((row) => (row.tags as unknown as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");

  const initialValues: SkillFormInitialValues = {
    id: skill.id,
    slug: skill.slug,
    status: skill.status,
    editorIsAdmin: isAdmin,
    title: skill.title,
    description: skill.description,
    category_id: skill.category_id,
    tagsInput,
    trigger_description: skill.trigger_description,
    instructions_body: skill.instructions_body,
    required_tools_guidance: skill.required_tools_guidance,
    example_usage: skill.example_usage,
    expected_output_notes: skill.expected_output_notes,
  };

  const categories = await listCategories(supabase, "skill");

  return <SkillForm mode="edit" initialValues={initialValues} categories={categories} isAdmin={isAdmin} />;
}
