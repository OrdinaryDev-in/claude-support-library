import { defineConfig, devices } from "@playwright/test";
// @next/env's CJS build sets __esModule:true with its actual `default`
// export left undefined (its real functions are named CJS exports, no
// `export default` in its source) — a default import (`import x from`)
// compiles here to accessing that empty `.default` and crashes with
// "Cannot destructure property 'loadEnvConfig' of '_env.default' as it is
// undefined", confirmed by actually running it through Playwright's own
// config loader (playwright.config.ts is loaded via Playwright's internal
// CJS transform, not plain Node ESM — the two interop differently for
// this package, which is why this needs to be verified against the real
// loader, not just `node` directly). A namespace import avoids the
// `.default` indirection entirely and exposes the real named exports.
import * as nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

// .env.test.local must already exist by the time this config file loads —
// `npm run test:e2e` (package.json) runs scripts/write-e2e-env.sh first,
// before invoking `playwright test` at all, specifically so this works.
//
// Two separate things need these values, not just one:
//  1. e2e/core-flows.spec.ts itself reads process.env.NEXT_PUBLIC_SUPABASE_URL
//     / SUPABASE_SERVICE_ROLE_KEY directly (to build its own admin
//     supabase-js client for the promote-to-admin step) — that's *this*
//     process (and the workers Playwright forks from it, which inherit
//     process.env at fork time), not webServer's child process.
//  2. The Next.js app itself, built fresh by webServer below, needs
//     NEXT_PUBLIC_* inlined at build time.
// loadEnvConfig here handles (1); NODE_ENV=test in webServer.env (which
// makes Next skip .env.local and load .env.test.local, same as this call
// does here) handles (2). Using the same @next/env loader Next itself uses
// keeps the parsing (quoting, etc.) identical between the two — an earlier
// round of this file's history hit a real bug from a mismatch there.
//
// NODE_ENV must already be "test" in *this* process for loadEnvConfig to
// pick .env.test.local over .env.local — set via the npm script
// (`NODE_ENV=test playwright test`), not here, since this file needs to
// already know which env to load before any code in it runs.
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // e2e/core-flows.spec.ts is a deliberately serial user journey
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    // 127.0.0.1, not localhost: supabase/config.toml's [auth] site_url is
    // http://127.0.0.1:3000, and GoTrue validates signUp()'s
    // emailRedirectTo (AuthForm.tsx sets it to window.location.origin +
    // "/callback...") against that exact allow-list — a "localhost"
    // origin doesn't match "127.0.0.1" as a string even though they
    // resolve to the same place, so GoTrue rejected every signup with a
    // redirect-not-allowed error. That's why "sign up creates an account"
    // failed identically on every run and its retry: not a flake, a fixed
    // mismatch that fails the exact same way every time. AuthForm just
    // calls setError() on that response (no throw, no CSP violation, no
    // failed request) — consistent with the earlier failure's diagnostics
    // showing nothing at all.
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Always rebuilds before starting — Next.js inlines NEXT_PUBLIC_* env
  // vars at BUILD time into every bundle (server/middleware included, not
  // just client-side code); `next start` only serves whatever was already
  // compiled into .next/, so a stale prior build would silently keep
  // serving old values regardless of what env is present when `next
  // start` itself runs. NODE_ENV=test here (as well as already being set
  // in the parent process, see above) makes this build skip .env.local
  // and load .env.test.local instead — no precedence fight, .env.local
  // (pointed at the real project) is just never consulted.
  webServer: {
    command: "npm run build && npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NODE_ENV: "test" },
  },
});
