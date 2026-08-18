"use client";

import { useState } from "react";
import { updateFullName, updatePassword } from "@/app/actions/profile";
import { MySubmissions } from "@/components/profile/MySubmissions";
import type { PromptRow } from "@/lib/data/prompts";

export interface ProfileData {
  initials: string;
  fullName: string;
  email: string;
  role: "user" | "admin";
  memberSince: string;
  lastLogin: string;
}

export function ProfileForm({ profile, submissions }: { profile: ProfileData; submissions: PromptRow[] }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleSaveProfile() {
    setProfileError(null);
    setSavingProfile(true);
    const result = await updateFullName(fullName);
    setSavingProfile(false);
    if (!result.ok) {
      setProfileError(result.error);
      return;
    }
    showToast("Profile saved");
  }

  async function handleResetPw() {
    setPwError(null);
    setSavingPw(true);
    const result = await updatePassword(currentPw, newPw, confirmPw);
    setSavingPw(false);
    if (!result.ok) {
      setPwError(result.error);
      return;
    }
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    showToast("Password updated");
  }

  const labelClass = "block text-xs text-[var(--muted)] mb-1.5";
  const sectionHeading =
    "font-[family-name:var(--font-mono)] text-[11px] tracking-wide text-[var(--muted)] uppercase mb-3";
  const activeBtn =
    "px-4 py-2.5 rounded-md border border-[var(--brass)] bg-transparent text-[var(--brass)] text-[13px] font-semibold disabled:opacity-45";

  return (
    <div className="flex-1 w-full mx-auto max-w-[640px] px-4 sm:px-8 py-8 sm:py-12 pb-24">
      <div className="text-xs text-[var(--muted)] mb-4">
        <a href="/library" className="text-[var(--muted)] no-underline hover:text-[var(--text)]">
          Library
        </a>{" "}
        / Profile
      </div>
      <h1 className="font-[family-name:var(--font-display)] font-medium text-2xl sm:text-[28px] mb-6 sm:mb-8">
        Your profile
      </h1>

      <div className="flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 sm:p-[22px] mb-7">
        <div className="w-14 h-14 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-[family-name:var(--font-mono)] text-lg text-[var(--brass)] shrink-0">
          {profile.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-[var(--text)] truncate">{profile.fullName}</div>
          <div className="text-[13px] text-[var(--muted)] truncate">{profile.email}</div>
        </div>
        {profile.role === "admin" && (
          <span className="font-[family-name:var(--font-mono)] text-[11px] px-2.5 py-1 border border-[var(--border)] rounded text-[var(--brass)] uppercase tracking-wide shrink-0">
            Admin
          </span>
        )}
      </div>

      <div className={sectionHeading}>Account details</div>
      <div className="flex flex-col gap-3.5 mb-8">
        <div>
          <label htmlFor="profile-full-name" className={labelClass}>
            Full name
          </label>
          <input
            id="profile-full-name"
            className="dv-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="profile-email" className={labelClass}>
            Email
          </label>
          <input id="profile-email" className="dv-input" value={profile.email} disabled />
        </div>
        <div className="flex gap-6">
          <div className="flex-1">
            <div className="text-xs text-[var(--muted)] mb-1">Member since</div>
            <div className="font-[family-name:var(--font-mono)] text-[13px]">{profile.memberSince}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-[var(--muted)] mb-1">Last login</div>
            <div className="font-[family-name:var(--font-mono)] text-[13px]">{profile.lastLogin}</div>
          </div>
        </div>
        {profileError && (
          <div role="alert" className="text-xs text-[var(--danger)]">
            {profileError}
          </div>
        )}
        <div>
          <button onClick={handleSaveProfile} disabled={savingProfile} className={activeBtn}>
            {savingProfile ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="h-px bg-[var(--border)] mb-7" />

      <div className={sectionHeading}>My submissions</div>
      <div className="mb-8">
        <MySubmissions submissions={submissions} />
      </div>

      <div className="h-px bg-[var(--border)] mb-7" />

      <div className={sectionHeading}>Reset password</div>
      <div className="flex flex-col gap-3.5 max-w-[400px]">
        <div>
          <label htmlFor="profile-current-pw" className={labelClass}>
            Current password
          </label>
          <input
            id="profile-current-pw"
            type="password"
            className="dv-input"
            placeholder="••••••••"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="profile-new-pw" className={labelClass}>
            New password
          </label>
          <input
            id="profile-new-pw"
            type="password"
            className="dv-input"
            placeholder="At least 8 characters"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="profile-confirm-pw" className={labelClass}>
            Confirm new password
          </label>
          <input
            id="profile-confirm-pw"
            type="password"
            className="dv-input"
            placeholder="••••••••"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
          />
        </div>
        {pwError && (
          <div role="alert" className="text-xs text-[var(--danger)]">
            {pwError}
          </div>
        )}
        <div>
          <button onClick={handleResetPw} disabled={savingPw} className={activeBtn}>
            {savingPw ? "Updating…" : "Update password"}
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-7 left-1/2 -translate-x-1/2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg px-[18px] py-3 z-[60] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        >
          <span className="text-[13px] font-semibold text-[var(--teal)]">{toast}</span>
        </div>
      )}
    </div>
  );
}
