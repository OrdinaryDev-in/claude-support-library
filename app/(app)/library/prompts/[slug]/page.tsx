import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PromptDetail } from "@/components/prompts/PromptDetail";
import { assembleTemplate } from "@/lib/validation/prompt-schema";
import type { PromptWithTags } from "@/lib/data/prompts";

// Same noindex reasoning as app/(app)/library/page.tsx — this route is
// guest-readable (an unauthenticated visitor, crawler included, gets a
// Supabase anonymous session rather than a login redirect), so `noindex`
// is doing real work here, not just documenting an already-unreachable
// URL. Dynamic per-prompt title/description still matter for the
// signed-in/guest UX (browser tab, history, bookmarks, and — per WCAG
// 2.4.2 — screen reader users navigating between prompts by document
// title).
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

  // proxy.ts (lib/supabase/middleware.ts) already ran getUser() (or, for
  // an unauthenticated visitor here, signInAnonymously()) for this request
  // and forwards the verified id via this header — reading it here
  // instead of calling getUser() again skips a repeat Supabase Auth round
  // trip. A guest gets a real (anonymous-session) userId here, never
  // matching prompt.author_id and never resolving to an admin role below,
  // so isOwner naturally stays false for them — this route needs no
  // separate guest branch.
  const userId = (await headers()).get("x-user-id");

  const { data: prompt, error } = await supabase
    .from("prompts")
    .select("*, categories(key, label, color)")
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
  if (userId) {
    if (userId === prompt.author_id) {
      isOwner = true;
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      isOwner = profile?.role === "admin";
    }
  }

  const promptWithTags = { ...prompt, tags } as unknown as PromptWithTags;
  const templateText = assembleTemplate(prompt);

  return <PromptDetail prompt={promptWithTags} templateText={templateText} isOwner={isOwner} />;
}
