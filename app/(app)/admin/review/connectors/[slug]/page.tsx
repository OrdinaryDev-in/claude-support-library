import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ConnectorReviewDetail } from "@/components/admin/ConnectorReviewDetail";
import type { ReviewQueueRow } from "@/lib/data/connectors";

// Mirrors app/(app)/admin/review/skills/[slug]/page.tsx.
export async function generateMetadata({
  params,
}: PageProps<"/admin/review/connectors/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: connector } = await supabase.from("connectors").select("title").eq("slug", slug).single();

  return {
    title: connector ? `Review: ${connector.title}` : "Review",
    robots: { index: false, follow: false },
  };
}

export default async function ConnectorReviewDetailPage({
  params,
}: PageProps<"/admin/review/connectors/[slug]">) {
  const { slug } = await params;

  const userId = (await headers()).get("x-user-id");
  if (!userId) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (profile?.role !== "admin") notFound();

  const { data: connector, error } = await supabase
    .from("connectors")
    .select("*, categories(key, label, color), author:profiles!connectors_author_id_fkey(full_name, email)")
    .eq("slug", slug)
    .single();
  if (error || !connector) notFound();

  const row = connector as unknown as ReviewQueueRow;

  return <ConnectorReviewDetail connector={row} />;
}
