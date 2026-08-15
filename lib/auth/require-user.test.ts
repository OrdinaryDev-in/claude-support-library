import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSupabaseClient, mockQueryResult } from "@/lib/testing/mock-supabase";

const { createClientMock, redirectMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    // The real next/navigation redirect() throws a special NEXT_REDIRECT
    // control-flow error that only Next's runtime understands — mock it
    // the same way (throw) so callers that don't catch it still stop.
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const { requireUser, isAuthorOrAdmin } = await import("./require-user");

beforeEach(() => {
  createClientMock.mockReset();
  redirectMock.mockClear();
});

describe("requireUser", () => {
  it("redirects to /login when there's no signed-in user", async () => {
    createClientMock.mockResolvedValue(mockSupabaseClient({ user: null }));
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("returns the supabase client and user when signed in", async () => {
    const client = mockSupabaseClient({ user: { id: "user-1" } });
    createClientMock.mockResolvedValue(client);
    const result = await requireUser();
    expect(result.user).toEqual({ id: "user-1" });
    expect(result.supabase).toBe(client);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("isAuthorOrAdmin", () => {
  it("returns true without a DB call when the user is the author", async () => {
    const client = mockSupabaseClient();
    const result = await isAuthorOrAdmin(client as never, "user-1", "user-1");
    expect(result).toBe(true);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("returns true for a different user who has the admin role", async () => {
    const client = mockSupabaseClient({
      from: () => mockQueryResult({ data: { role: "admin" }, error: null }),
    });
    const result = await isAuthorOrAdmin(client as never, "user-2", "user-1");
    expect(result).toBe(true);
  });

  it("returns false for a different user without the admin role", async () => {
    const client = mockSupabaseClient({
      from: () => mockQueryResult({ data: { role: "user" }, error: null }),
    });
    const result = await isAuthorOrAdmin(client as never, "user-2", "user-1");
    expect(result).toBe(false);
  });

  it("returns false when the profile lookup errors", async () => {
    const client = mockSupabaseClient({
      from: () => mockQueryResult({ data: null, error: { message: "not found" } }),
    });
    const result = await isAuthorOrAdmin(client as never, "user-2", "user-1");
    expect(result).toBe(false);
  });
});
