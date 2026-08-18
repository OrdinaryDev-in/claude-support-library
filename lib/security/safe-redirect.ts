/**
 * Validates a caller-supplied `next` redirect target before it's used to
 * send the browser anywhere. Used by app/(auth)/callback/route.ts, whose
 * `next` query param comes straight from the URL an attacker fully
 * controls (a crafted OAuth/email-confirmation link).
 *
 * Today that route builds the redirect as `${origin}${next}` — string
 * concatenation that happens to prevent a functional open redirect
 * (`next=https://evil.com` just produces a malformed, same-origin-rooted
 * URL, not a cross-origin navigation). But that safety is incidental to
 * *how* the value happens to be used, not enforced by the value itself —
 * a future refactor that uses `next` directly (e.g. passing it straight
 * to `redirect()` or a client-side `router.push`) would reintroduce a
 * real open redirect with no warning. Validate explicitly instead of
 * relying on the call site never changing.
 *
 * Only a same-origin, single-leading-slash path is allowed:
 * - `//evil.com` and `/\evil.com` are protocol-relative or
 *   backslash-as-slash tricks some browsers normalize into a
 *   different-origin navigation — rejected.
 * - Anything with a scheme (`https://…`, `javascript:…`) is rejected.
 * - Anything not starting with `/` at all is rejected.
 */
export function sanitizeNextPath(raw: string | null | undefined, fallback = "/library"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // A scheme can still sneak in after the leading slash is satisfied
  // (e.g. "/\t/evil.com" or a stray colon) — belt-and-braces reject
  // anything that parses as an absolute URL once given a dummy base.
  try {
    const resolved = new URL(raw, "http://localhost");
    if (resolved.origin !== "http://localhost") return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
