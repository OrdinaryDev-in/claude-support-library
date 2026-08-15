import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

const { checkRateLimit } = await import("./rate-limit");

beforeEach(() => {
  createClientMock.mockReset();
});

describe("checkRateLimit", () => {
  it("returns true when the RPC reports within-limit", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    createClientMock.mockResolvedValue({ rpc });
    const result = await checkRateLimit("mutate_prompt", "user-1", 20, 300);
    expect(result).toBe(true);
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_bucket: "mutate_prompt",
      p_identity: "user-1",
      p_max_hits: 20,
      p_window_seconds: 300,
    });
  });

  it("returns false when the RPC reports over-limit", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    createClientMock.mockResolvedValue({ rpc });
    const result = await checkRateLimit("mutate_prompt", "user-1", 20, 300);
    expect(result).toBe(false);
  });

  it("fails open (returns true) when the RPC errors", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    createClientMock.mockResolvedValue({ rpc });
    const result = await checkRateLimit("mutate_prompt", "user-1", 20, 300);
    expect(result).toBe(true);
  });
});
