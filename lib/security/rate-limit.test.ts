import { describe, it, expect } from "vitest";
import { checkRateLimit, getClientIp } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the max within the window", () => {
    const key = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, { max: 5, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("blocks the request once max is exceeded", () => {
    const key = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { max: 3, windowMs: 60_000 });
    }
    expect(checkRateLimit(key, { max: 3, windowMs: 60_000 }).allowed).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${crypto.randomUUID()}`;
    const keyB = `test-b-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(keyA, { max: 3, windowMs: 60_000 });

    expect(checkRateLimit(keyA, { max: 3, windowMs: 60_000 }).allowed).toBe(false);
    expect(checkRateLimit(keyB, { max: 3, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("resets once the window has passed", () => {
    const key = `test-${crypto.randomUUID()}`;
    checkRateLimit(key, { max: 1, windowMs: 1 }); // consumes the only slot
    expect(checkRateLimit(key, { max: 1, windowMs: 1 }).allowed).toBe(false);

    // windowMs: 1 means the window has already elapsed by the time we
    // check again synchronously after — a fresh window should reopen it.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(checkRateLimit(key, { max: 1, windowMs: 1 }).allowed).toBe(true);
        resolve();
      }, 5);
    });
  });
});

describe("getClientIp", () => {
  it("reads the first address from x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(getClientIp(request)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "203.0.113.9" },
    });
    expect(getClientIp(request)).toBe("203.0.113.9");
  });

  it("falls back to a constant, not an unbounded bucket, when neither header is present", () => {
    const request = new Request("http://localhost");
    expect(getClientIp(request)).toBe("unknown");
  });
});
