import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/data/categories";
import { ConnectorForm } from "@/components/connectors/ConnectorForm";

// Mirrors app/(app)/library/skills/new/page.tsx.
export default async function NewConnectorPage() {
  const supabase = await createClient();
  const categories = await listCategories(supabase, "connector");

  const userId = (await headers()).get("x-user-id");
  let isAdmin = false;
  if (userId) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
    isAdmin = profile?.role === "admin";
  }

  return <ConnectorForm mode="create" categories={categories} isAdmin={isAdmin} />;
}
