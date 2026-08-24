import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock, type SupabaseMock } from "@/test/supabase-mock";
import type { ConnectorFormValues } from "@/lib/validation/connector-schema";
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
const CONNECTOR_ID = "44444444-4444-4444-4444-444444444444";
const CATEGORY_ID = "66666666-6666-4666-8666-666666666666";

const VALID_FORM: ConnectorFormValues = {
  title: "Test Connector",
  description: "A test connector for the authorization boundary suite.",
  category_id: CATEGORY_ID,
  tagsInput: "mcp, github",
  setup_steps: "Install the server, add the config block.",
  config_snippet: "{ \"mcpServers\": {} }",
  gotchas_notes: "Watch the rate limit.",
  docs_links: "[LINK: official docs]",
};

const INVALID_FORM = { ...VALID_FORM, title: "" } as ConnectorFormValues;

function setUser(supabase: SupabaseMock, id: string | null) {
  supabase.auth.getUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

describe("app/actions/connectors.ts — authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimitStoreForTests();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("createConnector", () => {
    it("redirects to /login when unauthenticated", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, null);
      mockCreateClient.mockResolvedValue(supabase);
      const { createConnector } = await import("./connectors");

      await expect(createConnector(VALID_FORM)).rejects.toThrow("REDIRECT:/login");
    });

    it("rejects invalid input without touching the database", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { createConnector } = await import("./connectors");

      const result = await createConnector(INVALID_FORM);

      expect(result.ok).toBe(false);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("inserts with author_id set to the current user, ignoring any caller-supplied value", async () => {
      const supabase = createSupabaseMock([
        { data: null, error: null }, // uniqueSlug: no existing connector with this slug
        { data: { id: CONNECTOR_ID, slug: "test-connector" }, error: null }, // insert
        { data: null, error: null }, // syncTags: delete existing connector_tags
        { data: null, error: null }, // syncTags: tags select "mcp"
        { data: { id: "tag-1" }, error: null }, // syncTags: tags insert "mcp"
        { data: null, error: null }, // syncTags: connector_tags insert "mcp"
        { data: null, error: null }, // syncTags: tags select "github"
        { data: { id: "tag-2" }, error: null }, // syncTags: tags insert "github"
        { data: null, error: null }, // syncTags: connector_tags insert "github"
      ]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { createConnector } = await import("./connectors");

      const result = await createConnector(VALID_FORM);

      expect(result).toEqual({ ok: true, slug: "test-connector" });
    });
  });

  describe("updateConnector", () => {
    it("returns 'Connector not found' when the row doesn't exist", async () => {
      const supabase = createSupabaseMock([{ data: null, error: { message: "no rows" } }]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { updateConnector } = await import("./connectors");

      const result = await updateConnector(CONNECTOR_ID, VALID_FORM);

      expect(result).toEqual({ ok: false, error: "Connector not found." });
    });

    it("denies a signed-in user who is neither the author nor an admin", async () => {
      const supabase = createSupabaseMock([
        { data: { id: CONNECTOR_ID, author_id: AUTHOR_ID, slug: "test-connector", title: "Test Connector" }, error: null },
        { data: { role: "user" }, error: null }, // isAuthorOrAdmin
      ]);
      setUser(supabase, OTHER_USER_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { updateConnector } = await import("./connectors");

      const result = await updateConnector(CONNECTOR_ID, VALID_FORM);

      expect(result).toEqual({ ok: false, error: "You don't have permission to edit this connector." });
    });

    it("allows the connector's own author to update it", async () => {
      const supabase = createSupabaseMock([
        { data: { id: CONNECTOR_ID, author_id: AUTHOR_ID, slug: "test-connector", title: "Test Connector" }, error: null },
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
      const { updateConnector } = await import("./connectors");

      const result = await updateConnector(CONNECTOR_ID, VALID_FORM);

      expect(result).toEqual({ ok: true, slug: "test-connector" });
    });

    it("allows an admin to update a connector they don't own", async () => {
      const supabase = createSupabaseMock([
        { data: { id: CONNECTOR_ID, author_id: AUTHOR_ID, slug: "test-connector", title: "Test Connector" }, error: null },
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
      const { updateConnector } = await import("./connectors");

      const result = await updateConnector(CONNECTOR_ID, VALID_FORM);

      expect(result).toEqual({ ok: true, slug: "test-connector" });
    });
  });

  describe("deleteConnector", () => {
    it("denies a signed-in user who is neither the author nor an admin", async () => {
      const supabase = createSupabaseMock([
        { data: { id: CONNECTOR_ID, author_id: AUTHOR_ID }, error: null },
        { data: { role: "user" }, error: null },
      ]);
      setUser(supabase, OTHER_USER_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { deleteConnector } = await import("./connectors");

      const result = await deleteConnector(CONNECTOR_ID);

      expect(result).toEqual({ ok: false, error: "You don't have permission to delete this connector." });
    });

    it("allows the connector's own author to delete it", async () => {
      const supabase = createSupabaseMock([
        { data: { id: CONNECTOR_ID, author_id: AUTHOR_ID }, error: null },
        { data: null, error: null }, // delete
      ]);
      setUser(supabase, AUTHOR_ID);
      mockCreateClient.mockResolvedValue(supabase);
      const { deleteConnector } = await import("./connectors");

      const result = await deleteConnector(CONNECTOR_ID);

      expect(result).toEqual({ ok: true });
    });

    it("redirects to /login when unauthenticated", async () => {
      const supabase = createSupabaseMock();
      setUser(supabase, null);
      mockCreateClient.mockResolvedValue(supabase);
      const { deleteConnector } = await import("./connectors");

      await expect(deleteConnector(CONNECTOR_ID)).rejects.toThrow("REDIRECT:/login");
    });
  });

  describe("loadMoreConnectors", () => {
    it("passes the given offset/page-size through to searchConnectors", async () => {
      vi.resetModules();
      vi.doMock("@/lib/data/connectors", async () => {
        const actual = await vi.importActual<typeof import("@/lib/data/connectors")>("@/lib/data/connectors");
        return { ...actual, searchConnectors: vi.fn().mockResolvedValue([]) };
      });
      const supabase = createSupabaseMock();
      mockCreateClient.mockResolvedValue(supabase);
      const { loadMoreConnectors } = await import("./connectors");
      const { searchConnectors, CONNECTORS_PAGE_SIZE } = await import("@/lib/data/connectors");

      await loadMoreConnectors({ categoryId: null, tags: [], q: "" }, 20);

      expect(searchConnectors).toHaveBeenCalledWith(
        supabase,
        { categoryId: null, tags: [], q: "" },
        { offset: 20, limit: CONNECTORS_PAGE_SIZE }
      );
      vi.doUnmock("@/lib/data/connectors");
    });
  });
});
