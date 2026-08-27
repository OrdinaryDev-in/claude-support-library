import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LibraryHub } from "@/components/library/LibraryHub";

// This route (and everything under /library) is guest-readable —
// lib/supabase/middleware.ts transparently gives an unauthenticated
// visitor, crawlers included, a Supabase anonymous session rather than
// redirecting to /login (see GUEST_READABLE_PATHS there). A crawler *can*
// reach this page now, but app/robots.ts still disallows it, and `noindex`
// is the correct signal to carry on the page itself too, independent of
// whatever's currently disallowing it in robots.txt.
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
