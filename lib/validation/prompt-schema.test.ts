import { describe, expect, it } from "vitest";
import {
  assembleTemplate,
  parseTagsInput,
  promptSchema,
  slugify,
} from "./prompt-schema";

const validFields = {
  title: "Build a REST API",
  description: "A prompt for scaffolding a REST API.",
  category: "new_app" as const,
  tagsInput: "api, postgres",
  base_instructions: "Build a REST API with auth.",
  fill_in_details_guidance: "Fill in your stack.",
  reference_projects_guidance: "Point at a similar project.",
  reference_links_guidance: "Link the framework docs.",
  expected_output_notes: "Expect a working server.",
};

describe("promptSchema", () => {
  it("accepts a fully valid set of fields", () => {
    const result = promptSchema.safeParse(validFields);
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = promptSchema.safeParse({ ...validFields, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only title", () => {
    const result = promptSchema.safeParse({ ...validFields, title: "   " });
    expect(result.success).toBe(false);
  });

  it("accepts a title at the 140-char boundary", () => {
    const result = promptSchema.safeParse({ ...validFields, title: "a".repeat(140) });
    expect(result.success).toBe(true);
  });

  it("rejects a title past the 140-char boundary", () => {
    const result = promptSchema.safeParse({ ...validFields, title: "a".repeat(141) });
    expect(result.success).toBe(false);
  });

  it("accepts a description at the 300-char boundary", () => {
    const result = promptSchema.safeParse({ ...validFields, description: "a".repeat(300) });
    expect(result.success).toBe(true);
  });

  it("rejects a description past the 300-char boundary", () => {
    const result = promptSchema.safeParse({ ...validFields, description: "a".repeat(301) });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid category", () => {
    const result = promptSchema.safeParse({ ...validFields, category: "not_a_category" });
    expect(result.success).toBe(false);
  });

  it("defaults tagsInput to an empty string when omitted", () => {
    const rest = { ...validFields };
    delete (rest as { tagsInput?: string }).tagsInput;
    const result = promptSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.tagsInput).toBe("");
  });

  it("rejects whitespace-only guidance fields", () => {
    const result = promptSchema.safeParse({ ...validFields, base_instructions: "   " });
    expect(result.success).toBe(false);
  });

  it.each([
    "fill_in_details_guidance",
    "reference_projects_guidance",
    "reference_links_guidance",
    "expected_output_notes",
  ] as const)("requires %s", (field) => {
    const result = promptSchema.safeParse({ ...validFields, [field]: "" });
    expect(result.success).toBe(false);
  });
});

describe("parseTagsInput", () => {
  it("splits, trims, and lowercases comma-separated tags", () => {
    expect(parseTagsInput("API, Postgres")).toEqual([
      { name: "api", slug: "api" },
      { name: "postgres", slug: "postgres" },
    ]);
  });

  it("dedupes case-insensitively", () => {
    expect(parseTagsInput("api, Postgres, api")).toEqual([
      { name: "api", slug: "api" },
      { name: "postgres", slug: "postgres" },
    ]);
  });

  it("returns an empty array for an empty string", () => {
    expect(parseTagsInput("")).toEqual([]);
  });

  it("ignores extra commas and whitespace-only entries", () => {
    expect(parseTagsInput("a,, b ,")).toEqual([
      { name: "a", slug: "a" },
      { name: "b", slug: "b" },
    ]);
  });

  it("slugifies multi-word tag names", () => {
    expect(parseTagsInput("edge functions")).toEqual([
      { name: "edge functions", slug: "edge-functions" },
    ]);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Build a REST API")).toBe("build-a-rest-api");
  });

  it("collapses repeated punctuation into a single hyphen", () => {
    expect(slugify("Fix -- the!! bug??")).toBe("fix-the-bug");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--Leading and trailing--")).toBe("leading-and-trailing");
  });

  it("returns an empty string for input with no alphanumerics", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("assembleTemplate", () => {
  it("assembles all sections in order", () => {
    const output = assembleTemplate({
      base_instructions: "Context here.",
      fill_in_details_guidance: "Details here.",
      reference_projects_guidance: "Projects here.",
      reference_links_guidance: "Links here.",
      expected_output_notes: "Output here.",
    });
    expect(output).toBe(
      [
        "## Task Context",
        "Context here.",
        "",
        "## Fill In Your Details",
        "Details here.",
        "",
        "## Similar Reference Projects",
        "Projects here.",
        "",
        "## Reference Links",
        "Links here.",
        "",
        "## Expected Output",
        "Output here.",
      ].join("\n")
    );
  });

  it("falls back to an em dash for empty fields", () => {
    const output = assembleTemplate({
      base_instructions: "",
      fill_in_details_guidance: "",
      reference_projects_guidance: "",
      reference_links_guidance: "",
      expected_output_notes: "",
    });
    expect(output).toContain("—");
  });
});
