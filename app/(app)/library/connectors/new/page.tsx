import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/data/categories";
import { ConnectorForm } from "@/components/connectors/ConnectorForm";

// Mirrors app/(app)/library/skills/new/page.tsx.
export default async function NewConnectorPage() {
  // /library is guest-readable (proxy.ts), so a guest's anonymous session
  // reaches this route too — bounce to /signup before rendering the form
  // rather than letting them fill it out only to be redirected on submit
  // (createConnector()'s own requireUser() would reject it there either way).
  if ((await headers()).get("x-is-guest") === "1") redirect("/signup");

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
