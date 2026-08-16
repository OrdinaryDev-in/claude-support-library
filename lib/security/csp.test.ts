import { describe, it, expect, vi, afterEach } from "vitest";
import { buildCsp } from "./csp";

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  vi.restoreAllMocks();
});

describe("buildCsp", () => {
  it("includes the Supabase host in connect-src for a normal URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";

    const { header } = buildCsp();

    expect(header).toContain("connect-src 'self' https://project-ref.supabase.co wss://project-ref.supabase.co");
  });

  it("strips stray surrounding quotes rather than crashing (the actual bug this test guards)", () => {
    // Reproduces: `TypeError: Invalid URL ... input: '"http://127.0.0.1:54321"'`
    // — a real failure hit when NEXT_PUBLIC_SUPABASE_URL ends up with
    // literal quote characters baked into its value.
    process.env.NEXT_PUBLIC_SUPABASE_URL = '"http://127.0.0.1:54321"';

    const { header } = buildCsp();

    // http in, http out (see the next test) — not hardcoded to https.
    expect(header).toContain("connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321");
  });

  it("uses http/ws (not https/wss) for a local/self-hosted Supabase URL", () => {
    // A local `supabase start` stack (used by e2e/core-flows.spec.ts and
    // CI's test-e2e job) serves plain HTTP on 127.0.0.1 — connect-src
    // must match the scheme actually used, or every Supabase request
    // would be silently dropped the moment CSP_ENFORCE=true is set
    // against a local/self-hosted target (report-only mode doesn't block,
    // which is exactly why this had gone unnoticed).
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";

    const { header } = buildCsp();

    expect(header).toContain("connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321");
    expect(header).not.toContain("https://127.0.0.1:54321");
    expect(header).not.toContain("wss://127.0.0.1:54321");
  });

  it("omits the Supabase host, doesn't throw, and logs a warning for a genuinely invalid URL", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.NEXT_PUBLIC_SUPABASE_URL = "not a url";

    const { header } = buildCsp();

    expect(header).toContain("connect-src 'self'");
    expect(header).not.toContain("supabase");
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("omits the Supabase host without throwing when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const { header } = buildCsp();

    expect(header).toContain("connect-src 'self'");
  });

  it("still generates a fresh nonce even when the URL is malformed", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '"http://127.0.0.1:54321"';

    const { nonce: nonce1 } = buildCsp();
    const { nonce: nonce2 } = buildCsp();

    expect(nonce1).not.toBe(nonce2);
  });
});
