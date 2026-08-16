import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Validates required env vars before webServer even starts — see its
  // header comment for why (fails fast with an actionable message
  // instead of a 60s webServer timeout hiding an opaque crash).
  globalSetup: "./e2e/global-setup.ts",
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
  // CI's test-e2e job runs `npm run build` itself before this, then
  // relies on this to start the server against that build. Locally,
  // reuses an already-running `npm run dev` so this doesn't fight with a
  // dev server you already have open.
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
