"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LIBRARY_SECTIONS } from "@/lib/constants/library-sections";

export interface NavBarUser {
  initials: string;
  fullName: string;
}

export function NavBar({ user }: { user: NavBarUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const onHub = pathname === "/library";
  const onPrompts = pathname.startsWith("/library/prompts");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape" && target === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(
      onPrompts ? window.location.search : ""
    );
    if (query.trim()) params.set("q", query.trim());
    else params.delete("q");
    router.push(`/library/prompts?${params.toString()}`);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const linkClass = (active: boolean) =>
    active
      ? "text-[var(--text)] text-sm font-medium border-b-2 border-[var(--brass)] pb-1"
      : "text-[var(--muted)] text-sm font-medium pb-1 hover:text-[var(--text)] transition-colors";

  return (
    <div className="flex items-center justify-between h-16 px-4 sm:px-8 bg-[var(--surface)] border-b border-[var(--border)] shrink-0">
      <div className="flex items-center gap-6 sm:gap-9 min-w-0">
        <Link href="/library" className="flex items-baseline gap-1.5 shrink-0">
          <span className="font-[family-name:var(--font-display)] text-[19px] font-semibold text-[var(--text)]">
            DevAtlas
          </span>
          <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--brass)] tracking-wider">
            v1
          </span>
        </Link>
        <nav className="hidden sm:flex gap-5">
          <Link href="/library" className={linkClass(onHub)}>
            Library
          </Link>
          <Link href="/library/prompts" className={linkClass(onPrompts)}>
            Prompts
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3.5">
        <form onSubmit={submitSearch} className="hidden md:flex">
          <div className="flex items-center gap-2 px-2.5 py-1.5 border border-[var(--border)] rounded-md text-[var(--muted)] text-[13px] focus-within:border-[var(--brass)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts"
              aria-label="Search prompts"
              className="bg-transparent outline-none w-32 placeholder:text-[var(--muted)] text-[var(--text)]"
            />
            <span className="font-[family-name:var(--font-mono)] text-[10px] border border-[var(--border)] rounded px-[5px] py-px text-[var(--muted)]">
              /
            </span>
          </div>
        </form>

        {user ? (
          <>
            <button
              onClick={handleSignOut}
              className="hidden sm:inline text-[var(--muted)] text-[13px] hover:text-[var(--text)] transition-colors"
            >
              Sign out
            </button>
            <Link
              href="/account"
              className="w-[30px] h-[30px] rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center font-[family-name:var(--font-mono)] text-xs text-[var(--brass)] shrink-0"
              aria-label="Your profile"
            >
              {user.initials}
            </Link>
          </>
        ) : null}

        <button
          className="sm:hidden text-[var(--text)]"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="sm:hidden absolute top-16 left-0 right-0 bg-[var(--surface)] border-b border-[var(--border)] flex flex-col p-4 gap-3 z-30">
          <form onSubmit={submitSearch} className="flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded-md text-[var(--muted)] text-[13px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search prompts"
              aria-label="Search prompts"
              className="bg-transparent outline-none flex-1 placeholder:text-[var(--muted)] text-[var(--text)]"
            />
          </form>
          {LIBRARY_SECTIONS.filter((s) => s.enabled || s.key === "prompts").map((s) => (
            <Link
              key={s.key}
              href={s.href}
              onClick={() => setMenuOpen(false)}
              className="text-[var(--text)] text-sm"
            >
              {s.label}
            </Link>
          ))}
          <Link href="/library" onClick={() => setMenuOpen(false)} className="text-[var(--text)] text-sm">
            Library
          </Link>
          {user && (
            <button onClick={handleSignOut} className="text-left text-[var(--muted)] text-sm">
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
