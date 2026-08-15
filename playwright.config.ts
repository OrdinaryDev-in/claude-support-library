import { defineConfig, devices } from "@playwright/test";

// Runs against a local Supabase stack (`supabase start`, already a
// devDependency) — not against the real linked project. Not wired into
// the required CI checks (see .github/workflows/e2e.yml): supabase
// start pulls ~10 Docker images and is slow/flaky to run on every push.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_LOCAL_URL ?? "http://127.0.0.1:54321",
      // Run `supabase start` once, then `supabase status` to get this
      // project's local anon key (it's dev-only and never touches a real
      // project, but isn't hardcoded here since the CLI doesn't guarantee
      // a fixed value across versions).
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_LOCAL_ANON_KEY ?? "",
    },
  },
});
