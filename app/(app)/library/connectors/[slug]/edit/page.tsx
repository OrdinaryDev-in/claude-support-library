import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/data/categories";
import { ConnectorForm, type ConnectorFormInitialValues } from "@/components/connectors/ConnectorForm";

// Mirrors app/(app)/library/skills/[slug]/edit/page.tsx.
export default async function EditConnectorPage({ params }: PageProps<"/library/connectors/[slug]/edit">) {
  const { slug } = await params;

  const userId = (await headers()).get("x-user-id");
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: connector, error } = await supabase.from("connectors").select("*").eq("slug", slug).single();
  if (error || !connector) notFound();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  const isAdmin = profile?.role === "admin";

  const allowed = userId === connector.author_id || isAdmin;
  if (!allowed) redirect(`/library/connectors/${connector.slug}`);

  const { data: joins } = await supabase.from("connector_tags").select("tags(name)").eq("connector_id", connector.id);
  const tagsInput = (joins ?? [])
    .map((row) => (row.tags as unknown as { name: string } | null)?.name)
    .filter((name): name is string => Boolean(name))
    .join(", ");

  const initialValues: ConnectorFormInitialValues = {
    id: connector.id,
    slug: connector.slug,
    status: connector.status,
    editorIsAdmin: isAdmin,
    title: connector.title,
    description: connector.description,
    category_id: connector.category_id,
    tagsInput,
    setup_steps: connector.setup_steps,
    config_snippet: connector.config_snippet,
    gotchas_notes: connector.gotchas_notes,
    docs_links: connector.docs_links,
  };

  const categories = await listCategories(supabase, "connector");

  return <ConnectorForm mode="edit" initialValues={initialValues} categories={categories} isAdmin={isAdmin} />;
}
