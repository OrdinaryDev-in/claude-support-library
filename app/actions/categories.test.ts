import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import { __resetRateLimitStoreForTests } from "@/lib/security/rate-limit";

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
const CATEGORY_ID = "55555555-5555-5555-5555-555555555555";

function setUser(supabase: SupabaseMock, id: string | null) {
  supabase.auth.getUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

describe("app/actions/categories.ts — authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Same reasoning as review.test.ts — reused fixture admin ids across
    // tests would otherwise share requireAdmin()'s rate-limit bucket.
    __resetRateLimitStoreForTests();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const validCategory = { resource_type: "prompt" as const, key: "ops_infra", label: "Ops / Infra", color: "#9c7bd9", sort_order: 0 };

  describe("createCategory", () => {
    it("redirects to /login when unauthenticated", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, null);
      mockCreateClient.mockResolvedValue(supabase);
      const { createCategory } = await import("./categories");

      await expect(createCategory(validCategory)).rejects.toThrow("REDIRECT:/login");
    });

    it("denies a signed-in non-admin", async () => {
      const supabase = createSupabaseMock([
        { data: { role: "user" }, error: null }, // requireAdmin: caller's own profile role lookup
      ]);
      setUser(supabase, NON_ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { createCategory } = await import("./categories");

      const result = await createCategory(validCategory);

      expect(result).toEqual({
        ok: false,
        error: "You don't have permission to manage categories.",
      });
    });

    it("rejects an invalid key without touching the database", async () => {
      const supabase = createSupabaseMock([{ data: { role: "admin" }, error: null }]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { createCategory } = await import("./categories");

      const result = await createCategory({ ...validCategory, key: "Not A Valid Key!" });

      expect(result.ok).toBe(false);
      expect(supabase.from).toHaveBeenCalledTimes(1); // only the requireAdmin lookup, not an insert
    });

    it("allows an admin to create a category, returning the created row", async () => {
      const createdRow = { id: CATEGORY_ID, key: validCategory.key, label: validCategory.label, color: validCategory.color };
      const supabase = createSupabaseMock([
        { data: { role: "admin" }, error: null }, // requireAdmin
        { data: createdRow, error: null }, // insert...select().single()
      ]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { createCategory } = await import("./categories");

      const result = await createCategory(validCategory);

      expect(result).toEqual({ ok: true, category: createdRow });
    });

    it("surfaces a clean message on a duplicate (resource_type, key)", async () => {
      const supabase = createSupabaseMock([
        { data: { role: "admin" }, error: null }, // requireAdmin
        { data: null, error: { code: "23505", message: "duplicate key value" } }, // insert
      ]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { createCategory } = await import("./categories");

      const result = await createCategory(validCategory);

      expect(result).toEqual({
        ok: false,
        error: "A category with this key already exists for this resource type.",
      });
    });
  });

  describe("deleteCategory", () => {
    it("denies a signed-in non-admin", async () => {
      const supabase = createSupabaseMock([{ data: { role: "user" }, error: null }]);
      setUser(supabase, NON_ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { deleteCategory } = await import("./categories");

      const result = await deleteCategory(CATEGORY_ID);

      expect(result).toEqual({
        ok: false,
        error: "You don't have permission to manage categories.",
      });
    });

    it("surfaces a clean message when the category is still in use", async () => {
      const supabase = createSupabaseMock([
        { data: { role: "admin" }, error: null }, // requireAdmin
        { data: null, error: { code: "23503", message: "foreign key violation" } }, // delete
      ]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { deleteCategory } = await import("./categories");

      const result = await deleteCategory(CATEGORY_ID);

      expect(result).toEqual({
        ok: false,
        error: "This category is still in use — reassign or remove those items first.",
      });
    });
  });
});
