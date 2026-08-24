import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { __resetRateLimitStoreForTests } from "@/lib/security/rate-limit";

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
const CONNECTOR_ID = "44444444-4444-4444-4444-444444444444";

function setUser(supabase: SupabaseMock, id: string | null) {
  supabase.auth.getUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

describe("app/actions/connector-review.ts — authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimitStoreForTests();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("approveConnector", () => {
    it("redirects to /login when unauthenticated", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, null);
      mockCreateClient.mockResolvedValue(supabase);
      const { approveConnector } = await import("./connector-review");

      await expect(approveConnector(CONNECTOR_ID)).rejects.toThrow("REDIRECT:/login");
    });

    it("denies a signed-in non-admin", async () => {
      const supabase = createSupabaseMock([{ data: { role: "user" }, error: null }]);
      setUser(supabase, NON_ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { approveConnector } = await import("./connector-review");

      const result = await approveConnector(CONNECTOR_ID);

      expect(result).toEqual({ ok: false, error: "You don't have permission to review connectors." });
    });

    it("allows an admin to approve, clearing any prior rejection reason", async () => {
      const supabase = createSupabaseMock([
        { data: { role: "admin" }, error: null }, // requireAdmin
        { data: { slug: "test-connector" }, error: null }, // update
      ]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { approveConnector } = await import("./connector-review");

      const result = await approveConnector(CONNECTOR_ID);

      expect(result).toEqual({ ok: true });
    });
  });

  describe("rejectConnector", () => {
    it("denies a signed-in non-admin", async () => {
      const supabase = createSupabaseMock([{ data: { role: "user" }, error: null }]);
      setUser(supabase, NON_ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { rejectConnector } = await import("./connector-review");

      const result = await rejectConnector(CONNECTOR_ID, "Doesn't fit the library.");

      expect(result).toEqual({ ok: false, error: "You don't have permission to review connectors." });
    });

    it("rejects an empty reason without touching the database", async () => {
      const supabase = createSupabaseMock([{ data: { role: "admin" }, error: null }]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { rejectConnector } = await import("./connector-review");

      const result = await rejectConnector(CONNECTOR_ID, "   ");

      expect(result).toEqual({ ok: false, error: "A reason is required." });
    });

    it("allows an admin to reject with a reason", async () => {
      const supabase = createSupabaseMock([
        { data: { role: "admin" }, error: null }, // requireAdmin
        { data: { slug: "test-connector" }, error: null }, // update
      ]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { rejectConnector } = await import("./connector-review");

      const result = await rejectConnector(CONNECTOR_ID, "Doesn't fit the library.");

      expect(result).toEqual({ ok: true });
    });
  });
});
