import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PromptForm, type PromptFormInitialValues } from "@/components/prompts/PromptForm";

export default async function EditPromptPage({
  params,
}: PageProps<"/library/prompts/[slug]/edit">) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: prompt, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error || !prompt) notFound();

  let allowed = user.id === prompt.author_id;
  if (!allowed) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    allowed = profile?.role === "admin";
  }
  if (!allowed) redirect(`/library/prompts/${prompt.slug}`);

  const { data: joins } = await supabase
    .from("prompt_tags")
    .select("tags(name)")
    .eq("prompt_id", prompt.id);
  const tagsInput = (joins ?? [])
    .map((row) => (row.tags as unknown as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");

  const initialValues: PromptFormInitialValues = {
    id: prompt.id,
    slug: prompt.slug,
    status: prompt.status,
    title: prompt.title,
    description: prompt.description,
    category: prompt.category,
    tagsInput,
    base_instructions: prompt.base_instructions,
    fill_in_details_guidance: prompt.fill_in_details_guidance,
    reference_projects_guidance: prompt.reference_projects_guidance,
    reference_links_guidance: prompt.reference_links_guidance,
    expected_output_notes: prompt.expected_output_notes,
  };

  return <PromptForm mode="edit" initialValues={initialValues} />;
}
