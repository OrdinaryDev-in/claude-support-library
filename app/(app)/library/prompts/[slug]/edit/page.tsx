import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PromptForm, type PromptFormInitialValues } from "@/components/prompts/PromptForm";

export default async function EditPromptPage({
  params,
}: PageProps<"/library/prompts/[slug]/edit">) {
  const { slug } = await params;

  // proxy.ts (lib/supabase/middleware.ts) already ran getUser() for this
  // request and forwards the verified id via this header — reading it
  // here instead of calling getUser() again skips a repeat Supabase Auth
  // round trip.
  const userId = (await headers()).get("x-user-id");
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: prompt, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error || !prompt) notFound();

  // Fetched unconditionally (not just when the editor isn't the author) —
  // guard_prompt_review_state()'s admin exemption (0009/0014) is keyed on
  // is_admin(auth.uid()), not on authorship, so an admin editing their own
  // approved prompt still skips the resubmit-for-review reset. PromptForm
  // needs to know that to avoid showing a "will resubmit" warning that
  // isn't true for an admin editor.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  const isAdmin = profile?.role === "admin";

  const allowed = userId === prompt.author_id || isAdmin;
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
    editorIsAdmin: isAdmin,
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
