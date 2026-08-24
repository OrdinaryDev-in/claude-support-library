/** Slug/tag helpers shared across every resource type's validation schema
 * (Prompts today; Skills/Connectors reuse these directly rather than
 * duplicating them, per Phase 2's Part 2 genericization). Previously lived
 * only in prompt-schema.ts. */

/** Turns "api, postgres, auth" into normalized, deduped tag slugs+names. */
export function parseTagsInput(input: string): { name: string; slug: string }[] {
  const seen = new Set<string>();
  return input
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
    .filter((t) => {
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    })
    .map((name) => ({ name, slug: name.replace(/\s+/g, "-") }));
}

export function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
