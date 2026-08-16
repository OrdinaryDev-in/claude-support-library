import { describe, it, expect, vi, beforeEach } from "vitest";

const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({ headers: () => mockHeaders() }));

function headersWithIp(ip: string) {
  return new Headers({ "x-forwarded-for": ip });
}

// A fresh, random-ish IP per test so each test gets its own bucket in
// checkRateLimit's module-level in-memory store — same reasoning as
// lib/security/rate-limit.test.ts's crypto.randomUUID() keys.
function freshIp() {
  return `203.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

describe("app/actions/auth.ts — checkAuthRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests up to the max, then blocks", async () => {
    mockHeaders.mockReturnValue(headersWithIp(freshIp()));
    const { checkAuthRateLimit } = await import("./auth");

    for (let i = 0; i < 10; i++) {
      expect((await checkAuthRateLimit("login")).allowed).toBe(true);
    }
    expect((await checkAuthRateLimit("login")).allowed).toBe(false);
  });

  it("tracks login and signup as separate buckets for the same IP — hitting one doesn't lock out the other", async () => {
    mockHeaders.mockReturnValue(headersWithIp(freshIp()));
    const { checkAuthRateLimit } = await import("./auth");

    for (let i = 0; i < 10; i++) await checkAuthRateLimit("login");
    expect((await checkAuthRateLimit("login")).allowed).toBe(false);
    expect((await checkAuthRateLimit("signup")).allowed).toBe(true);
  });

  it("tracks separate IPs independently", async () => {
    const ipA = freshIp();
    const ipB = freshIp();

    mockHeaders.mockReturnValue(headersWithIp(ipA));
    const { checkAuthRateLimit } = await import("./auth");
    for (let i = 0; i < 10; i++) await checkAuthRateLimit("login");
    expect((await checkAuthRateLimit("login")).allowed).toBe(false);

    mockHeaders.mockReturnValue(headersWithIp(ipB));
    expect((await checkAuthRateLimit("login")).allowed).toBe(true);
  });
});
