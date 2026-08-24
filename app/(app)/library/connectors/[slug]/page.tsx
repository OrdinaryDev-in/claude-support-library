import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ConnectorDetail } from "@/components/connectors/ConnectorDetail";
import { assembleConnectorTemplate } from "@/lib/validation/connector-schema";
import type { ConnectorWithTags } from "@/lib/data/connectors";

// Mirrors app/(app)/library/skills/[slug]/page.tsx.
export async function generateMetadata({
  params,
}: PageProps<"/library/connectors/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: connector } = await supabase.from("connectors").select("title, description").eq("slug", slug).single();

  if (!connector) return { title: "Connector not found", robots: { index: false, follow: false } };

  return {
    title: connector.title,
    description: connector.description,
    robots: { index: false, follow: false },
  };
}

export default async function ConnectorDetailPage({ params }: PageProps<"/library/connectors/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();

  const userId = (await headers()).get("x-user-id");

  const { data: connector, error } = await supabase
    .from("connectors")
    .select("*, categories(key, label, color)")
    .eq("slug", slug)
    .single();

  if (error || !connector) notFound();

  const { data: joins } = await supabase.from("connector_tags").select("tags(name)").eq("connector_id", connector.id);
  const tags = (joins ?? [])
    .map((row) => (row.tags as unknown as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name));

  let isOwner = false;
  if (userId) {
    if (userId === connector.author_id) {
      isOwner = true;
    } else {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
      isOwner = profile?.role === "admin";
    }
  }

  const connectorWithTags = { ...connector, tags } as unknown as ConnectorWithTags;
  const templateText = assembleConnectorTemplate(connector);

  return <ConnectorDetail connector={connectorWithTags} templateText={templateText} isOwner={isOwner} />;
}
