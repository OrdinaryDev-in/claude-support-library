import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PromptDetail } from "@/components/prompts/PromptDetail";
import { assembleTemplate } from "@/lib/validation/prompt-schema";
import type { PromptWithTags } from "@/lib/data/prompts";

// Same noindex reasoning as app/(app)/library/page.tsx — this route
// requires a signed-in session, so a crawler never reaches it anonymously
// regardless. Dynamic per-prompt title/description still matter for the
// signed-in UX (browser tab, history, bookmarks, and — per WCAG 2.4.2 —
// screen reader users navigating between prompts by document title).
export async function generateMetadata({
  params,
}: PageProps<"/library/prompts/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: prompt } = await supabase
    .from("prompts")
    .select("title, description")
    .eq("slug", slug)
    .single();

  if (!prompt) return { title: "Prompt not found", robots: { index: false, follow: false } };

  return {
    title: prompt.title,
    description: prompt.description,
    robots: { index: false, follow: false },
  };
}

export default async function PromptDetailPage({
  params,
}: PageProps<"/library/prompts/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: prompt, error } = await supabase
    .from("prompts")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !prompt) notFound();

  const { data: joins } = await supabase
    .from("prompt_tags")
    .select("tags(name)")
    .eq("prompt_id", prompt.id);
  const tags = (joins ?? [])
    .map((row) => (row.tags as unknown as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name));

  let isOwner = false;
  if (user) {
    if (user.id === prompt.author_id) {
      isOwner = true;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isOwner = profile?.role === "admin";
    }
  }

  const promptWithTags: PromptWithTags = { ...prompt, tags };
  const templateText = assembleTemplate(prompt);

  return <PromptDetail prompt={promptWithTags} templateText={templateText} isOwner={isOwner} />;
}
