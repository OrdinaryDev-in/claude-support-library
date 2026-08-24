import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import type { SkillFormValues } from "@/lib/validation/skill-schema";
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

const AUTHOR_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";
const ADMIN_ID = "33333333-3333-3333-3333-333333333333";
const SKILL_ID = "44444444-4444-4444-4444-444444444444";
const CATEGORY_ID = "66666666-6666-4666-8666-666666666666";

const VALID_FORM: SkillFormValues = {
  title: "Test Skill",
  description: "A test skill for the authorization boundary suite.",
  category_id: CATEGORY_ID,
  tagsInput: "claude-code, cursor",
  trigger_description: "When the user needs X.",
  instructions_body: "Do the thing.",
  required_tools_guidance: "File read/write.",
  example_usage: "Input -> output.",
  expected_output_notes: "Should include X.",
};

const INVALID_FORM = { ...VALID_FORM, title: "" } as SkillFormValues;

function setUser(supabase: SupabaseMock, id: string | null) {
  supabase.auth.getUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

describe("app/actions/skills.ts — authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimitStoreForTests();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("createSkill", () => {
    it("redirects to /login when unauthenticated", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, null);
      mockCreateClient.mockResolvedValue(supabase);
      const { createSkill } = await import("./skills");

      await expect(createSkill(VALID_FORM)).rejects.toThrow("REDIRECT:/login");
    });

    it("rejects invalid input without touching the database", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { createSkill } = await import("./skills");

      const result = await createSkill(INVALID_FORM);

      expect(result.ok).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("inserts with author_id set to the current user, ignoring any caller-supplied value", async () => {
      const supabase = createSupabaseMock([
        { data: null, error: null }, // uniqueSlug: no existing skill with this slug
        { data: { id: SKILL_ID, slug: "test-skill" }, error: null }, // insert
        { data: null, error: null }, // syncTags: delete existing skill_tags
        { data: null, error: null }, // syncTags: tags select "claude-code"
        { data: { id: "tag-1" }, error: null }, // syncTags: tags insert "claude-code"
        { data: null, error: null }, // syncTags: skill_tags insert "claude-code"
        { data: null, error: null }, // syncTags: tags select "cursor"
        { data: { id: "tag-2" }, error: null }, // syncTags: tags insert "cursor"
        { data: null, error: null }, // syncTags: skill_tags insert "cursor"
      ]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { createSkill } = await import("./skills");

      const result = await createSkill(VALID_FORM);

      expect(result).toEqual({ ok: true, slug: "test-skill" });
    });
  });

  describe("updateSkill", () => {
    it("returns 'Skill not found' when the row doesn't exist", async () => {
      const supabase = createSupabaseMock([{ data: null, error: { message: "no rows" } }]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { updateSkill } = await import("./skills");

      const result = await updateSkill(SKILL_ID, VALID_FORM);

      expect(result).toEqual({ ok: false, error: "Skill not found." });
    });

    it("denies a signed-in user who is neither the author nor an admin", async () => {
      const supabase = createSupabaseMock([
        { data: { id: SKILL_ID, author_id: AUTHOR_ID, slug: "test-skill", title: "Test Skill" }, error: null },
        { data: { role: "user" }, error: null }, // isAuthorOrAdmin
      ]);
      setUser(supabase, OTHER_USER_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { updateSkill } = await import("./skills");

      const result = await updateSkill(SKILL_ID, VALID_FORM);

      expect(result).toEqual({ ok: false, error: "You don't have permission to edit this skill." });
    });

    it("allows the skill's own author to update it", async () => {
      const supabase = createSupabaseMock([
        { data: { id: SKILL_ID, author_id: AUTHOR_ID, slug: "test-skill", title: "Test Skill" }, error: null },
        { data: null, error: null }, // update
        { data: null, error: null }, // syncTags: delete
        { data: null, error: null },
        { data: { id: "tag-1" }, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: "tag-2" }, error: null },
        { data: null, error: null },
      ]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { updateSkill } = await import("./skills");

      const result = await updateSkill(SKILL_ID, VALID_FORM);

      expect(result).toEqual({ ok: true, slug: "test-skill" });
    });

    it("allows an admin to update a skill they don't own", async () => {
      const supabase = createSupabaseMock([
        { data: { id: SKILL_ID, author_id: AUTHOR_ID, slug: "test-skill", title: "Test Skill" }, error: null },
        { data: { role: "admin" }, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: "tag-1" }, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: { id: "tag-2" }, error: null },
        { data: null, error: null },
      ]);
      setUser(supabase, ADMIN_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { updateSkill } = await import("./skills");

      const result = await updateSkill(SKILL_ID, VALID_FORM);

      expect(result).toEqual({ ok: true, slug: "test-skill" });
    });
  });

  describe("deleteSkill", () => {
    it("denies a signed-in user who is neither the author nor an admin", async () => {
      const supabase = createSupabaseMock([
        { data: { id: SKILL_ID, author_id: AUTHOR_ID }, error: null },
        { data: { role: "user" }, error: null },
      ]);
      setUser(supabase, OTHER_USER_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { deleteSkill } = await import("./skills");

      const result = await deleteSkill(SKILL_ID);

      expect(result).toEqual({ ok: false, error: "You don't have permission to delete this skill." });
    });

    it("allows the skill's own author to delete it", async () => {
      const supabase = createSupabaseMock([
        { data: { id: SKILL_ID, author_id: AUTHOR_ID }, error: null },
        { data: null, error: null }, // delete
      ]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { deleteSkill } = await import("./skills");

      const result = await deleteSkill(SKILL_ID);

      expect(result).toEqual({ ok: true });
    });

    it("redirects to /login when unauthenticated", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, null);
      mockCreateClient.mockResolvedValue(supabase);
      const { deleteSkill } = await import("./skills");

      await expect(deleteSkill(SKILL_ID)).rejects.toThrow("REDIRECT:/login");
    });
  });

  describe("loadMoreSkills", () => {
    it("passes the given offset/page-size through to searchSkills", async () => {
      vi.resetModules();
      vi.doMock("@/lib/data/skills", async () => {
        const actual = await vi.importActual<typeof import("@/lib/data/skills")>("@/lib/data/skills");
        return { ...actual, searchSkills: vi.fn().mockResolvedValue([]) };
      });
      const supabase = createSupabaseMock();
      mockCreateClient.mockResolvedValue(supabase);
      const { loadMoreSkills } = await import("./skills");
      const { searchSkills, SKILLS_PAGE_SIZE } = await import("@/lib/data/skills");

      await loadMoreSkills({ categoryId: null, tags: [], q: "" }, 20);

      expect(searchSkills).toHaveBeenCalledWith(
        supabase,
        { categoryId: null, tags: [], q: "" },
        { offset: 20, limit: SKILLS_PAGE_SIZE }
      );
      vi.doUnmock("@/lib/data/skills");
    });
  });
});
