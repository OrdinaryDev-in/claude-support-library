import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SkillReviewDetail } from "@/components/admin/SkillReviewDetail";
import type { ReviewQueueRow } from "@/lib/data/skills";

// Mirrors app/(app)/admin/review/[slug]/page.tsx.
export async function generateMetadata({
  params,
}: PageProps<"/admin/review/skills/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: skill } = await supabase.from("skills").select("title").eq("slug", slug).single();

  return {
    title: skill ? `Review: ${skill.title}` : "Review",
    robots: { index: false, follow: false },
  };
}

export default async function SkillReviewDetailPage({
  params,
}: PageProps<"/admin/review/skills/[slug]">) {
  const { slug } = await params;

  const userId = (await headers()).get("x-user-id");
  if (!userId) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (profile?.role !== "admin") notFound();

  const { data: skill, error } = await supabase
    .from("skills")
    .select("*, categories(key, label, color), author:profiles!skills_author_id_fkey(full_name, email)")
    .eq("slug", slug)
    .single();
  if (error || !skill) notFound();

  const row = skill as unknown as ReviewQueueRow;

  return <SkillReviewDetail skill={row} />;
}
