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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : null;
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
