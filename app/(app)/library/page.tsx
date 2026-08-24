import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LibraryHub } from "@/components/library/LibraryHub";

// Every route under here requires a signed-in session (proxy.ts) — a
// crawler never reaches it anonymously anyway (see app/robots.ts), but
// `noindex` is the correct signal to carry on the page itself too,
// independent of whatever's currently gating access to it.
export const metadata: Metadata = {
  title: "The Library",
  robots: { index: false, follow: false },
};

export default async function LibraryHubPage() {
  const supabase = await createClient();
  const [{ count: promptsCount }, { count: skillsCount }, { count: connectorsCount }] = await Promise.all([
    supabase.from("prompts").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("skills").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("connectors").select("id", { count: "exact", head: true }).eq("status", "approved"),
  ]);

  return (
    <LibraryHub
      chartedCounts={{
        prompts: promptsCount ?? 0,
        skills: skillsCount ?? 0,
        connectors: connectorsCount ?? 0,
      }}
    />
  );
}
