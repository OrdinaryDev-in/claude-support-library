import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ReviewDetail } from "@/components/admin/ReviewDetail";
import type { ReviewQueueRow } from "@/lib/data/prompts";

export async function generateMetadata({
  params,
}: PageProps<"/admin/review/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: prompt } = await supabase.from("prompts").select("title").eq("slug", slug).single();

  return {
    title: prompt ? `Review: ${prompt.title}` : "Review",
    robots: { index: false, follow: false },
  };
}

export default async function ReviewDetailPage({
  params,
}: PageProps<"/admin/review/[slug]">) {
  const { slug } = await params;

  // See app/(app)/admin/review/page.tsx's comment — this skips a repeat
  // getUser() round trip already done in proxy.ts's middleware.
  const userId = (await headers()).get("x-user-id");
  if (!userId) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (profile?.role !== "admin") notFound();

  const { data: prompt, error } = await supabase
    .from("prompts")
    .select("*, categories(key, label, color), author:profiles!prompts_author_id_fkey(full_name, email)")
    .eq("slug", slug)
    .single();
  if (error || !prompt) notFound();

  const row = prompt as unknown as ReviewQueueRow;

  return <ReviewDetail prompt={row} />;
}
