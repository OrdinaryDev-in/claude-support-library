import { createClient } from "@/lib/supabase/server";
import { LibraryHub } from "@/components/library/LibraryHub";

export default async function LibraryHubPage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true);

  return <LibraryHub promptsCharted={count ?? 0} />;
}
