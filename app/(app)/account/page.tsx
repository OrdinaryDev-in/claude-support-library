import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm, type ProfileData } from "@/components/profile/ProfileForm";
import { mySubmissions } from "@/lib/data/prompts";

function initialsOf(name: string, email: string) {
  const source = name.trim();
  if (source) {
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }
  return email.slice(0, 2).toUpperCase();
}

function formatMemberSince(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLastLogin(iso: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, created_at, last_login_at")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const data: ProfileData = {
    initials: initialsOf(profile.full_name ?? "", profile.email),
    fullName: profile.full_name || profile.email,
    email: profile.email,
    role: profile.role,
    memberSince: formatMemberSince(profile.created_at),
    lastLogin: formatLastLogin(profile.last_login_at),
  };

  const submissions = await mySubmissions(supabase, user.id);

  return <ProfileForm profile={data} submissions={submissions} />;
}
