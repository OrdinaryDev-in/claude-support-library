import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "./middleware";

/**
 * Regression coverage for a real bug: a Server Action (e.g.
 * touchLastLogin() in AuthForm.tsx, called right after a successful
 * signUp() while still on /signup) POSTs to whatever page it was called
 * from. Before this fix, updateSession() treated that POST exactly like a
 * page navigation — "signed-in user hitting a signed-out-only path" — and
 * issued a plain redirect. Next's client-side Server Action handler can't
 * parse a bare redirect as a valid action response and throws a generic
 * "An unexpected response was received from the server.", silently
 * breaking the signup flow for every real user (confirmed by reading
 * node_modules/next/dist/.../server-action-reducer.js — that's its exact
 * fallback message whenever a response isn't RSC-shaped and isn't Next's
 * own action-redirect format). Reproduced first via a real E2E run, not
 * guessed.
 */
const mockGetUser = vi.fn();
const mockSignInAnonymously = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: mockGetUser, signInAnonymously: mockSignInAnonymously },
  }),
}));

function makeRequest(path: string, { serverAction = false }: { serverAction?: boolean } = {}) {
  const headers = new Headers();
  if (serverAction) headers.set("next-action", "some-action-id");
  return new NextRequest(`http://localhost:3000${path}`, { method: "POST", headers });
}

const SIGNED_IN_USER = { id: "user-1" };
const ANONYMOUS_GUEST = { id: "guest-1", is_anonymous: true };

beforeEach(() => {
  mockGetUser.mockReset();
  mockSignInAnonymously.mockReset();
});

describe("updateSession", () => {
  it("redirects a signed-out visitor to /login for a normal page request to a non-guest-readable route", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await updateSession(makeRequest("/account"), new Headers());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects a signed-in visitor away from /signup for a normal page request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: SIGNED_IN_USER } });

    const res = await updateSession(makeRequest("/signup"), new Headers());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/library");
  });

  it("does NOT redirect a Server Action request even when it targets a signed-out-only path (the bug this guards)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: SIGNED_IN_USER } });

    const res = await updateSession(makeRequest("/signup", { serverAction: true }), new Headers());

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect a signed-out Server Action request to /library either", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await updateSession(makeRequest("/library", { serverAction: true }), new Headers());

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
    // Server Actions don't need a fresh guest session created on their behalf.
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("still allows a signed-out request to an always-public path through", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await updateSession(makeRequest("/privacy"), new Headers());

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("creates a guest session instead of redirecting a signed-out visitor to /library", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockSignInAnonymously.mockResolvedValue({ data: { user: ANONYMOUS_GUEST } });
    const requestHeaders = new Headers();

    const res = await updateSession(makeRequest("/library"), requestHeaders);

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
    expect(mockSignInAnonymously).toHaveBeenCalledOnce();
    expect(requestHeaders.get("x-user-id")).toBe(ANONYMOUS_GUEST.id);
    expect(requestHeaders.get("x-is-guest")).toBe("1");
  });

  it("does not create a second guest session for a visitor who already has an anonymous one", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ANONYMOUS_GUEST } });

    const res = await updateSession(makeRequest("/library"), new Headers());

    expect(res.status).not.toBe(307);
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it("redirects an existing guest session away from a non-guest-readable route to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ANONYMOUS_GUEST } });

    const res = await updateSession(makeRequest("/account"), new Headers());

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("does NOT bounce a guest session away from /login the way a real signed-in user would be", async () => {
    mockGetUser.mockResolvedValue({ data: { user: ANONYMOUS_GUEST } });

    const res = await updateSession(makeRequest("/login"), new Headers());

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });
});
