import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewDetail } from "@/components/admin/ReviewDetail";
import type { ReviewQueueRow } from "@/lib/data/prompts";

export default async function ReviewDetailPage({
  params,
}: PageProps<"/admin/review/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") notFound();

  const { data: prompt, error } = await supabase
    .from("prompts")
    .select("*, author:profiles!prompts_author_id_fkey(full_name, email)")
    .eq("slug", slug)
    .single();
  if (error || !prompt) notFound();

  const row = prompt as unknown as ReviewQueueRow;

  return <ReviewDetail prompt={row} />;
}
