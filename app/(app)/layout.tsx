import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavBar, type NavBarUser } from "@/components/layout/NavBar";

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
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const navUser: NavBarUser = {
    initials: initialsOf(profile?.full_name ?? null, profile?.email ?? user.email ?? ""),
    fullName: profile?.full_name || profile?.email || user.email || "",
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--ink)] text-[var(--text)] relative">
      <NavBar user={navUser} />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
