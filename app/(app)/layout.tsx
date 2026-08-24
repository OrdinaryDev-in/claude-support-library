import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { NavBar, type NavBarUser } from "@/components/layout/NavBar";
import { reviewQueueCounts as promptReviewQueueCounts } from "@/lib/data/prompts";
import { reviewQueueCounts as skillReviewQueueCounts } from "@/lib/data/skills";
import { reviewQueueCounts as connectorReviewQueueCounts } from "@/lib/data/connectors";

function initialsOf(name: string | null, email: string) {
  const source = (name ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  }
  return email.slice(0, 2).toUpperCase();
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // proxy.ts (see lib/supabase/middleware.ts) already ran getUser() for
  // this request — a network round trip to Supabase Auth — and forwards
  // the verified id via this header. Reading it here instead of calling
  // getUser() again avoids paying that round trip twice per page load.
  const userId = (await headers()).get("x-user-id");

  // proxy.ts already redirects unauthenticated requests before they reach
  // this layout — this is a defense-in-depth backstop, not the primary gate.
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", userId)
    .single();

  const isAdmin = profile?.role === "admin";
  // Only fetch the queue counts for admins — reviewQueueCounts reads every
  // status via RLS's is_admin() branch, which a non-admin caller can't do
  // (and doesn't need to: they'd only ever see their own counts anyway).
  const [pendingPromptReviewCount, pendingSkillReviewCount, pendingConnectorReviewCount] = isAdmin
    ? await Promise.all([
        promptReviewQueueCounts(supabase).then((c) => c.pending_review),
        skillReviewQueueCounts(supabase).then((c) => c.pending_review),
        connectorReviewQueueCounts(supabase).then((c) => c.pending_review),
      ])
    : [0, 0, 0];

  const navUser: NavBarUser = {
    initials: initialsOf(profile?.full_name ?? null, profile?.email ?? ""),
    fullName: profile?.full_name || profile?.email || "",
    isAdmin,
    pendingPromptReviewCount,
    pendingSkillReviewCount,
    pendingConnectorReviewCount,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--ink)] text-[var(--text)] relative">
      {/* Visually hidden until focused — lets a keyboard user jump past the
          NavBar's links/search on every single page instead of tabbing
          through them every time. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-[var(--brass)] focus:text-[var(--ink)] focus:text-[13px] focus:font-semibold"
      >
        Skip to content
      </a>
      <NavBar user={navUser} />
      <main id="main-content" className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
