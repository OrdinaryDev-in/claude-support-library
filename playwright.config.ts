import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // e2e/core-flows.spec.ts is a deliberately serial user journey
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // A few things happen here, in order, every run:
  //  1. write-e2e-env.sh first checks the local Supabase stack is actually
  //     reachable (fails fast with an actionable message if not — this
  //     lives here, not in a Playwright globalSetup, because webServer's
  //     command is what the task runner starts FIRST; a globalSetup file
  //     only runs after plugin setup, i.e. after this command. See that
  //     script's header comment), then regenerates .env.test.local from
  //     the running stack (see its header comment for why this replaced
  //     relying on the invoking shell's own env — that proved unreliable
  //     across two rounds of debugging).
  //  2. NODE_ENV=test (below) makes Next.js skip .env.local entirely and
  //     load .env.test.local instead — no precedence fight, .env.local
  //     (pointed at the real project) is just never consulted.
  //  3. Always rebuilds before starting — Next.js inlines NEXT_PUBLIC_*
  //     env vars at BUILD time into every bundle (server/middleware
  //     included, not just client-side code); `next start` only serves
  //     whatever was already compiled into .next/, so a stale prior
  //     build would silently keep serving old values regardless of what
  //     env is present when `next start` itself runs.
  webServer: {
    command: "bash scripts/write-e2e-env.sh && npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NODE_ENV: "test" },
  },
});
