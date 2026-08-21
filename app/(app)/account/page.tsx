import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm, type ProfileData } from "@/components/profile/ProfileForm";
import { mySubmissions } from "@/lib/data/prompts";

export const metadata: Metadata = {
  title: "Your Profile",
  robots: { index: false, follow: false },
};

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
  // proxy.ts (lib/supabase/middleware.ts) already ran getUser() for this
  // request and forwards the verified id via this header — reading it
  // here instead of calling getUser() again skips a repeat Supabase Auth
  // round trip.
  const userId = (await headers()).get("x-user-id");
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, created_at, last_login_at")
    .eq("id", userId)
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

  const submissions = await mySubmissions(supabase, userId);

  return <ProfileForm profile={data} submissions={submissions} />;
}
