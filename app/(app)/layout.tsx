import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavBar, type NavBarUser } from "@/components/layout/NavBar";
import { reviewQueueCounts } from "@/lib/data/prompts";

function initialsOf(name: string | null, email: string) {
  const source = (name ?? "").trim();
  if (source) {
    const parts = source.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  }
  return email.slice(0, 2).toUpperCase();
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects unauthenticated requests before they reach
  // this layout — this is a defense-in-depth backstop, not the primary gate.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  // Only fetch the queue counts for admins — reviewQueueCounts reads every
  // status via RLS's is_admin() branch, which a non-admin caller can't do
  // (and doesn't need to: they'd only ever see their own counts anyway).
  const pendingReviewCount = isAdmin ? (await reviewQueueCounts(supabase)).pending_review : 0;

  const navUser: NavBarUser = {
    initials: initialsOf(profile?.full_name ?? null, profile?.email ?? user.email ?? ""),
    fullName: profile?.full_name || profile?.email || user.email || "",
    isAdmin,
    pendingReviewCount,
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
