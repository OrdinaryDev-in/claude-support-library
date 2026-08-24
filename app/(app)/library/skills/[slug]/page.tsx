import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SkillDetail } from "@/components/skills/SkillDetail";
import { assembleSkillTemplate } from "@/lib/validation/skill-schema";
import type { SkillWithTags } from "@/lib/data/skills";

// Mirrors app/(app)/library/prompts/[slug]/page.tsx.
export async function generateMetadata({
  params,
}: PageProps<"/library/skills/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: skill } = await supabase.from("skills").select("title, description").eq("slug", slug).single();

  if (!skill) return { title: "Skill not found", robots: { index: false, follow: false } };

  return {
    title: skill.title,
    description: skill.description,
    robots: { index: false, follow: false },
  };
}

export default async function SkillDetailPage({ params }: PageProps<"/library/skills/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();

  const userId = (await headers()).get("x-user-id");

  const { data: skill, error } = await supabase
    .from("skills")
    .select("*, categories(key, label, color)")
    .eq("slug", slug)
    .single();

  if (error || !skill) notFound();

  const { data: joins } = await supabase.from("skill_tags").select("tags(name)").eq("skill_id", skill.id);
  const tags = (joins ?? [])
    .map((row) => (row.tags as unknown as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name));

  let isOwner = false;
  if (userId) {
    if (userId === skill.author_id) {
      isOwner = true;
    } else {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
      isOwner = profile?.role === "admin";
    }
  }

  const skillWithTags = { ...skill, tags } as unknown as SkillWithTags;
  const templateText = assembleSkillTemplate(skill);

  return <SkillDetail skill={skillWithTags} templateText={templateText} isOwner={isOwner} />;
}
