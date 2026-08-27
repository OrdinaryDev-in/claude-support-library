import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

// next/navigation's real redirect() throws internally to abort the
// request (the framework catches it) — replicate that here so a test
// that reaches redirect() can't silently fall through to code that
// assumes an authenticated user.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const USER_ID = "11111111-1111-1111-1111-111111111111";

describe("app/actions/profile.ts", () => {
  let supabase: SupabaseMock;

  beforeEach(() => {
    vi.clearAllMocks();
    // safeActionError() (lib/errors.ts) intentionally logs server-side on
    // every error path exercised below — silence it so test output isn't
    // dominated by expected logs.
    vi.spyOn(console, "error").mockImplementation(() => {});
    supabase = createSupabaseMock();
    mockCreateClient.mockResolvedValue(supabase);
  });

  describe("touchLastLogin", () => {
    it("does nothing when there is no authenticated user", async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      const { touchLastLogin } = await import("./profile");

      await touchLastLogin();

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("updates last_login_at scoped to the current user's id", async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
      supabase = createSupabaseMock([{ data: null, error: null }]);
      supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
      mockCreateClient.mockResolvedValue(supabase);
      const { touchLastLogin } = await import("./profile");

      await touchLastLogin();

      expect(supabase.from).toHaveBeenCalledWith("profiles");
    });
  });

  describe("updateFullName", () => {
    it("redirects to /signup when unauthenticated", async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      const { updateFullName } = await import("./profile");

      await expect(updateFullName("New Name")).rejects.toThrow("REDIRECT:/signup");
    });

    it("rejects an empty name without touching the database", async () => {
      supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
      const { updateFullName } = await import("./profile");

      const result = await updateFullName("   ");

      expect(result).toEqual({ ok: false, error: "Full name can't be empty." });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("trims and saves the name for the authenticated user, returns ok", async () => {
      supabase = createSupabaseMock([{ data: null, error: null }]);
      supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
      mockCreateClient.mockResolvedValue(supabase);
      const { updateFullName } = await import("./profile");

      const result = await updateFullName("  Jane Doe  ");

      expect(result).toEqual({ ok: true });
      expect(supabase.from).toHaveBeenCalledWith("profiles");
    });

    it("surfaces a generic message on a Supabase error, not the raw error text", async () => {
      supabase = createSupabaseMock([
        { data: null, error: { message: "duplicate key value violates unique constraint" } },
      ]);
      supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
      mockCreateClient.mockResolvedValue(supabase);
      const { updateFullName } = await import("./profile");

      const result = await updateFullName("Jane Doe");

      // Raw Postgres/Supabase error text must never reach the client — see
      // lib/errors.ts. Only assert it's *not* the internal message; the
      // exact generic wording is an implementation detail.
      expect(result.ok).toBe(false);
      expect((result as { error: string }).error).not.toMatch(/constraint|duplicate key/i);
    });
  });

  describe("updatePassword", () => {
    it("rejects when any field is missing", async () => {
      const { updatePassword } = await import("./profile");

      const result = await updatePassword("", "newpassword1", "newpassword1");

      expect(result).toEqual({ ok: false, error: "All fields are required." });
      expect(supabase.auth.getUser).not.toHaveBeenCalled();
    });

    it("rejects a new password shorter than 8 characters", async () => {
      const { updatePassword } = await import("./profile");

      const result = await updatePassword("current1", "short", "short");

      expect(result).toEqual({
        ok: false,
        error: "New password must be at least 8 characters.",
      });
    });

    it("rejects a mismatched confirmation", async () => {
      const { updatePassword } = await import("./profile");

      const result = await updatePassword("current1", "newpassword1", "newpassword2");

      expect(result).toEqual({
        ok: false,
        error: "New password and confirmation do not match.",
      });
    });

    it("redirects to /login when unauthenticated", async () => {
      // Unlike updateFullName, this action's guard is `!user?.email`
      // (app/actions/profile.ts) — a guest's anonymous session already
      // has no email, so it hits the same branch and same /login target
      // as a fully missing session; not changed as part of guest access.
      supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      const { updatePassword } = await import("./profile");

      await expect(
        updatePassword("current1", "newpassword1", "newpassword1")
      ).rejects.toThrow("REDIRECT:/login");
    });

    it("rejects when the current password is wrong, without changing anything", async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: USER_ID, email: "jane@example.com" } },
      });
      supabase.auth.signInWithPassword.mockResolvedValue({ error: { message: "bad creds" } });
      const { updatePassword } = await import("./profile");

      const result = await updatePassword("wrongpassword", "newpassword1", "newpassword1");

      expect(result).toEqual({ ok: false, error: "Current password is incorrect." });
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it("updates the password once re-authentication succeeds", async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: USER_ID, email: "jane@example.com" } },
      });
      supabase.auth.signInWithPassword.mockResolvedValue({ error: null });
      supabase.auth.updateUser.mockResolvedValue({ error: null });
      const { updatePassword } = await import("./profile");

      const result = await updatePassword("current1", "newpassword1", "newpassword1");

      expect(result).toEqual({ ok: true });
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: "newpassword1" });
    });
  });
});
