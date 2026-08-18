import { describe, it, expect } from "vitest";
import { sanitizeNextPath } from "./safe-redirect";

describe("sanitizeNextPath", () => {
  it("allows a plain relative path", () => {
    expect(sanitizeNextPath("/library/prompts")).toBe("/library/prompts");
  });

  it("allows a path with a query string and hash", () => {
    expect(sanitizeNextPath("/library/prompts?q=api#section")).toBe(
      "/library/prompts?q=api#section"
    );
  });

  it("falls back when next is null/undefined/empty", () => {
    expect(sanitizeNextPath(null)).toBe("/library");
    expect(sanitizeNextPath(undefined)).toBe("/library");
    expect(sanitizeNextPath("")).toBe("/library");
  });

  it("falls back to a caller-supplied default", () => {
    expect(sanitizeNextPath(null, "/account")).toBe("/account");
  });

  it("rejects a protocol-relative URL (//evil.com)", () => {
    expect(sanitizeNextPath("//evil.com")).toBe("/library");
  });

  it("rejects a backslash-prefixed path (browser-normalization trick)", () => {
    expect(sanitizeNextPath("/\\evil.com")).toBe("/library");
  });

  it("rejects an absolute URL with a scheme", () => {
    expect(sanitizeNextPath("https://evil.com")).toBe("/library");
    expect(sanitizeNextPath("javascript:alert(1)")).toBe("/library");
  });

  it("rejects a path that doesn't start with a slash", () => {
    expect(sanitizeNextPath("evil.com")).toBe("/library");
    expect(sanitizeNextPath("library/prompts")).toBe("/library");
  });
});
