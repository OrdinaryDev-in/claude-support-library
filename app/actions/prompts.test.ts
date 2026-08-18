import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import type { PromptFormValues } from "@/lib/validation/prompt-schema";
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
const PROMPT_ID = "44444444-4444-4444-4444-444444444444";

const VALID_FORM: PromptFormValues = {
  title: "Test Prompt",
  description: "A test prompt for the authorization boundary suite.",
  category: "backend",
  tagsInput: "api, postgres",
  base_instructions: "Do the thing.",
  fill_in_details_guidance: "Fill this in.",
  reference_projects_guidance: "See prior work.",
  reference_links_guidance: "See docs.",
  expected_output_notes: "Should include X.",
};

const INVALID_FORM = { ...VALID_FORM, title: "" } as PromptFormValues;

function setUser(supabase: SupabaseMock, id: string | null) {
  supabase.auth.getUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

describe("app/actions/prompts.ts — authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Each test below calls a mutating action with one of a handful of
    // reused fixture user ids — without this, hits toward
    // checkPromptWriteRateLimit's per-user bucket (app/actions/prompts.ts)
    // would accumulate across unrelated tests in this file.
    __resetRateLimitStoreForTests();
    // safeActionError() (lib/errors.ts) logs server-side on error paths —
    // not exercised by the tests below today, but silenced defensively.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("createPrompt", () => {
    it("redirects to /login when unauthenticated", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, null);
      mockCreateClient.mockResolvedValue(supabase);
      const { createPrompt } = await import("./prompts");

      await expect(createPrompt(VALID_FORM)).rejects.toThrow("REDIRECT:/login");
    });

    it("rejects invalid input without touching the database", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { createPrompt } = await import("./prompts");

      const result = await createPrompt(INVALID_FORM);

      expect(result.ok).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("inserts with author_id set to the current user, ignoring any caller-supplied value", async () => {
      const supabase = createSupabaseMock([
        { data: null, error: null }, // uniqueSlug: no existing prompt with this slug
        { data: { id: PROMPT_ID, slug: "test-prompt" }, error: null }, // insert
        { data: null, error: null }, // syncTags: delete existing prompt_tags
        { data: null, error: null }, // syncTags: tags select "api"
        { data: { id: "tag-1" }, error: null }, // syncTags: tags insert "api"
        { data: null, error: null }, // syncTags: prompt_tags insert "api"
        { data: null, error: null }, // syncTags: tags select "postgres"
        { data: { id: "tag-2" }, error: null }, // syncTags: tags insert "postgres"
        { data: null, error: null }, // syncTags: prompt_tags insert "postgres"
      ]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { createPrompt } = await import("./prompts");

      const result = await createPrompt(VALID_FORM);

      expect(result).toEqual({ ok: true, slug: "test-prompt" });
    });
  });

  describe("updatePrompt", () => {
    it("returns 'Prompt not found' when the row doesn't exist", async () => {
      const supabase = createSupabaseMock([
        { data: null, error: { message: "no rows" } }, // fetch existing
      ]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { updatePrompt } = await import("./prompts");

      const result = await updatePrompt(PROMPT_ID, VALID_FORM);

      expect(result).toEqual({ ok: false, error: "Prompt not found." });
    });

    it("denies a signed-in user who is neither the author nor an admin", async () => {
      const supabase = createSupabaseMock([
        {
          data: { id: PROMPT_ID, author_id: AUTHOR_ID, slug: "test-prompt", title: "Test Prompt" },
          error: null,
        }, // fetch existing — owned by AUTHOR_ID
        { data: { role: "user" }, error: null }, // isAuthorOrAdmin: caller's own profile role lookup
      ]);
      setUser(supabase, OTHER_USER_ID); // a different, non-admin user
      mockCreateClient.mockResolvedValue(supabase);
      const { updatePrompt } = await import("./prompts");

      const result = await updatePrompt(PROMPT_ID, VALID_FORM);

      expect(result).toEqual({
        ok: false,
        error: "You don't have permission to edit this prompt.",
      });
    });

    it("allows the prompt's own author to update it", async () => {
      const supabase = createSupabaseMock([
        {
          data: { id: PROMPT_ID, author_id: AUTHOR_ID, slug: "test-prompt", title: "Test Prompt" },
          error: null,
        }, // fetch existing
        // title unchanged in VALID_FORM ("Test Prompt") so uniqueSlug is
        // skipped — the slug branch short-circuits before any more
        // .from() calls.
        { data: null, error: null }, // update
        { data: null, error: null }, // syncTags: delete
        { data: null, error: null }, // syncTags: tags select "api"
        { data: { id: "tag-1" }, error: null },
        { data: null, error: null },
        { data: null, error: null }, // syncTags: tags select "postgres"
        { data: { id: "tag-2" }, error: null },
        { data: null, error: null },
      ]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { updatePrompt } = await import("./prompts");

      const result = await updatePrompt(PROMPT_ID, VALID_FORM);

      expect(result).toEqual({ ok: true, slug: "test-prompt" });
    });

    it("allows an admin to update a prompt they don't own", async () => {
      const supabase = createSupabaseMock([
        {
          data: { id: PROMPT_ID, author_id: AUTHOR_ID, slug: "test-prompt", title: "Test Prompt" },
          error: null,
        },
        { data: { role: "admin" }, error: null }, // isAuthorOrAdmin: caller IS an admin
        { data: null, error: null }, // update
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
      const { updatePrompt } = await import("./prompts");

      const result = await updatePrompt(PROMPT_ID, VALID_FORM);

      expect(result).toEqual({ ok: true, slug: "test-prompt" });
    });
  });

  describe("deletePrompt", () => {
    it("denies a signed-in user who is neither the author nor an admin", async () => {
      const supabase = createSupabaseMock([
        { data: { id: PROMPT_ID, author_id: AUTHOR_ID }, error: null },
        { data: { role: "user" }, error: null },
      ]);
      setUser(supabase, OTHER_USER_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { deletePrompt } = await import("./prompts");

      const result = await deletePrompt(PROMPT_ID);

      expect(result).toEqual({
        ok: false,
        error: "You don't have permission to delete this prompt.",
      });
    });

    it("allows the prompt's own author to delete it", async () => {
      const supabase = createSupabaseMock([
        { data: { id: PROMPT_ID, author_id: AUTHOR_ID }, error: null },
        { data: null, error: null }, // delete
      ]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { deletePrompt } = await import("./prompts");

      const result = await deletePrompt(PROMPT_ID);

      expect(result).toEqual({ ok: true });
    });

    it("redirects to /login when unauthenticated", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, null);
      mockCreateClient.mockResolvedValue(supabase);
      const { deletePrompt } = await import("./prompts");

      await expect(deletePrompt(PROMPT_ID)).rejects.toThrow("REDIRECT:/login");
    });
  });

  describe("loadMorePrompts", () => {
    it("passes the given offset/page-size through to searchPrompts", async () => {
      vi.resetModules(); // force a fresh module graph so doMock below is honored
      vi.doMock("@/lib/data/prompts", async () => {
        const actual = await vi.importActual<typeof import("@/lib/data/prompts")>(
          "@/lib/data/prompts"
        );
        return { ...actual, searchPrompts: vi.fn().mockResolvedValue([]) };
      });
      const supabase = createSupabaseMock();
      mockCreateClient.mockResolvedValue(supabase);
      const { loadMorePrompts } = await import("./prompts");
      const { searchPrompts, PROMPTS_PAGE_SIZE } = await import("@/lib/data/prompts");

      await loadMorePrompts({ category: null, tags: [], q: "" }, 20);

      expect(searchPrompts).toHaveBeenCalledWith(
        supabase,
        { category: null, tags: [], q: "" },
        { offset: 20, limit: PROMPTS_PAGE_SIZE }
      );
      vi.doUnmock("@/lib/data/prompts");
    });
  });
});
