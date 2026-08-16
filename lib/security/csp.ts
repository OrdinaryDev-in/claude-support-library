/**
 * Builds a per-request Content-Security-Policy. Script directives use a
 * nonce (not `unsafe-inline`) so Next.js's own hydration/bootstrap scripts
 * still run — Next automatically applies the nonce found on the outgoing
 * `Content-Security-Policy` header to the inline scripts it injects, as
 * long as the same nonce is also forwarded as an `x-nonce` request header
 * (see proxy.ts, which does both). Style directives allow `unsafe-inline`
 * as a pragmatic tradeoff — inline-style injection is a much lower-severity
 * risk than inline-script injection, and Next/Tailwind's build output isn't
 * guaranteed nonce-clean for styles the way it is for scripts.
 *
 * Deployed as `Content-Security-Policy-Report-Only` until CSP_ENFORCE=true
 * is set (see proxy.ts) — flip only after a deploy cycle with zero
 * unexpected violation reports in the browser console / a report endpoint.
 */
export function buildCsp(): { nonce: string; header: string } {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const supabaseHost = getSupabaseHost();
  const connectSrc = ["'self'", supabaseHost && `https://${supabaseHost}`, supabaseHost && `wss://${supabaseHost}`]
    .filter(Boolean)
    .join(" ");

  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src ${connectSrc}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  return { nonce, header: directives.join("; ") };
}

/**
 * A malformed NEXT_PUBLIC_SUPABASE_URL (e.g. stray quote characters baked
 * into the value — easy to end up with when hand-assembling env vars from
 * `supabase status -o env`'s shell-quoted output via something other than
 * `source`, which is the one thing that actually parses `KEY="value"`
 * assignment syntax rather than treating the quotes as literal
 * characters) must never crash proxy.ts on every single request. Strips
 * a matching pair of surrounding quotes defensively, and falls back to
 * omitting the Supabase host from connect-src (CSP just ends up
 * stricter than intended) rather than throwing, if the value still isn't
 * a valid URL after that.
 */
function getSupabaseHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;

  const unquoted =
    (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
      ? raw.slice(1, -1)
      : raw;

  try {
    return new URL(unquoted).host;
  } catch {
    console.warn(
      `[buildCsp] NEXT_PUBLIC_SUPABASE_URL is not a valid URL (got: ${JSON.stringify(raw)}) — ` +
        "omitting it from the CSP's connect-src instead of crashing."
    );
    return null;
  }
}
