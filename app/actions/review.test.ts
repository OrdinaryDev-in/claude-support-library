import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";

// See app/actions/profile.test.ts for why redirect() needs to actually throw.
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

const ADMIN_ID = "33333333-3333-3333-3333-333333333333";
const NON_ADMIN_ID = "22222222-2222-2222-2222-222222222222";
const PROMPT_ID = "44444444-4444-4444-4444-444444444444";

function setUser(supabase: SupabaseMock, id: string | null) {
  supabase.auth.getUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

describe("app/actions/review.ts — authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("approvePrompt", () => {
    it("redirects to /login when unauthenticated", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, null);
      mockCreateClient.mockResolvedValue(supabase);
      const { approvePrompt } = await import("./review");

      await expect(approvePrompt(PROMPT_ID)).rejects.toThrow("REDIRECT:/login");
    });

    it("denies a signed-in non-admin", async () => {
      const supabase = createSupabaseMock([
        { data: { role: "user" }, error: null }, // requireAdmin: caller's own profile role lookup
      ]);
      setUser(supabase, NON_ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { approvePrompt } = await import("./review");

      const result = await approvePrompt(PROMPT_ID);

      expect(result).toEqual({
        ok: false,
        error: "You don't have permission to review prompts.",
      });
    });

    it("allows an admin to approve, clearing any prior rejection reason", async () => {
      const supabase = createSupabaseMock([
        { data: { role: "admin" }, error: null }, // requireAdmin
        { data: { slug: "test-prompt" }, error: null }, // update
      ]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { approvePrompt } = await import("./review");

      const result = await approvePrompt(PROMPT_ID);

      expect(result).toEqual({ ok: true });
    });
  });

  describe("rejectPrompt", () => {
    it("denies a signed-in non-admin", async () => {
      const supabase = createSupabaseMock([{ data: { role: "user" }, error: null }]);
      setUser(supabase, NON_ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { rejectPrompt } = await import("./review");

      const result = await rejectPrompt(PROMPT_ID, "Doesn't fit the library.");

      expect(result).toEqual({
        ok: false,
        error: "You don't have permission to review prompts.",
      });
    });

    it("rejects an empty reason without touching the database", async () => {
      const supabase = createSupabaseMock([{ data: { role: "admin" }, error: null }]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { rejectPrompt } = await import("./review");

      const result = await rejectPrompt(PROMPT_ID, "   ");

      expect(result).toEqual({ ok: false, error: "A reason is required." });
    });

    it("allows an admin to reject with a reason", async () => {
      const supabase = createSupabaseMock([
        { data: { role: "admin" }, error: null }, // requireAdmin
        { data: { slug: "test-prompt" }, error: null }, // update
      ]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { rejectPrompt } = await import("./review");

      const result = await rejectPrompt(PROMPT_ID, "Doesn't fit the library.");

      expect(result).toEqual({ ok: true });
    });
  });
});
