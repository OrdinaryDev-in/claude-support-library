import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Covers the flows README.md's "Verifying it works" section describes as
 * a manual QA pass: signup, login, create a prompt, a second account
 * being genuinely RLS-denied (not just UI-hidden) from editing it, that
 * denial lifting once promoted to admin, and category/tag filtering.
 *
 * Runs against the local Supabase stack (see .github/workflows/ci.yml's
 * test-e2e job, which starts one before this) — uses
 * SUPABASE_SERVICE_ROLE_KEY to promote an account to admin directly,
 * the programmatic equivalent of the SQL editor step README's own setup
 * instructions describe, since there's no self-serve promotion UI.
 *
 * Steps run serially and share state (the same browser context moves
 * through signup → login → create), matching one continuous user
 * journey rather than independent isolated tests.
 */
test.describe.configure({ mode: "serial" });

const run = Date.now();
// let, not const: reassigned on retry (see the first test) so a retry
// never reuses the exact same email as the attempt before it — serial
// mode re-runs the whole file from test 1 on retry, and the same email
// would otherwise turn an unrelated failure's retry into a spurious
// "user already registered" instead of a clean re-attempt.
let ownerEmail = `e2e-owner-${run}@example.com`;
let otherEmail = `e2e-other-${run}@example.com`;
const password = "correct-horse-battery-1";
const promptTitle = `E2E Test Prompt ${run}`;
let promptSlug = "";

test.beforeAll(() => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "e2e/core-flows.spec.ts needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "for the local Supabase stack — see .github/workflows/ci.yml's test-e2e job."
    );
  }
});

// A failed assertion (e.g. "still on /signup, expected /library") only
// says the *symptom* — it says nothing about *why*: a thrown client-side
// error, a CSP violation, a failed network request, all look identical
// from the URL alone. Piping the browser's own console/errors/failed
// requests into CI's plain stdout (prefixed so they're greppable) means
// the next failure carries its own root cause in the log the CI job
// already prints, instead of needing someone to separately pull down and
// open trace.zip.
test.beforeEach(async ({ page }) => {
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.log(`[browser:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    console.log(`[browser:uncaught] ${err.message}`);
  });
  page.on("requestfailed", (req) => {
    console.log(`[browser:requestfailed] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
});

test("sign up creates an account and lands in the library", async ({ page }, testInfo) => {
  if (testInfo.retry > 0) {
    ownerEmail = `e2e-owner-${run}-r${testInfo.retry}@example.com`;
    otherEmail = `e2e-other-${run}-r${testInfo.retry}@example.com`;
  }
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Doe").fill("E2E Owner");
  await page.getByPlaceholder("you@company.com").fill(ownerEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Local stack has email confirmation disabled (supabase/config.toml
  // [auth.email] enable_confirmations = false) so this lands in the app
  // directly, no inbox to check.
  await expect(page).toHaveURL(/\/library/);
});

test("owner can create a prompt", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(ownerEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/library/);

  await page.goto("/library/prompts/new");
  await page.getByPlaceholder(/Add Rate Limiting/).fill(promptTitle);
  await page
    .getByPlaceholder("One sentence — what this prompt gets you")
    .fill("Created by the E2E suite.");
  await page.getByRole("button", { name: "Backend" }).click();
  await page.getByPlaceholder("api, postgres, auth").fill("e2e-test");
  await page.getByPlaceholder("AI role and task-type framing").fill("You are a test.");
  await page.getByPlaceholder("[BRACKETED PLACEHOLDERS]").fill("[FIELD]");
  await page
    .getByPlaceholder("[LINKS/DESCRIPTIONS OF PRIOR WORK]")
    .fill("[NONE]");
  await page.getByPlaceholder("[CLOUD/DOCS LINKS]").fill("[NONE]");
  await page
    .getByPlaceholder("What a correct AI response must include")
    .fill("Nothing in particular.");
  await page.getByRole("button", { name: "Publish prompt" }).click();

  await expect(page).toHaveURL(/\/library\/prompts\/[^/]+$/, { timeout: 10_000 });
  promptSlug = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("heading", { name: promptTitle })).toBeVisible();
  // Owner sees edit controls.
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
});

test("a different signed-in account is denied editing it — redirected, not just UI-hidden", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Doe").fill("E2E Other");
  await page.getByPlaceholder("you@company.com").fill(otherEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/library/);

  await page.goto(`/library/prompts/${promptSlug}`);
  // No edit/delete controls for a non-owner.
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  // The real test: navigate straight to the edit URL, bypassing the
  // hidden button entirely. app/(app)/library/prompts/[slug]/edit/page.tsx
  // redirects non-owner/non-admin back to the detail page server-side.
  await page.goto(`/library/prompts/${promptSlug}/edit`);
  await expect(page).toHaveURL(new RegExp(`/library/prompts/${promptSlug}$`));
});

test("promoting that account to admin lifts the denial", async ({ page }) => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("email", otherEmail);
  expect(error).toBeNull();

  // Same session as the previous test (storageState persists per-worker
  // in serial mode is NOT guaranteed across `test()` blocks by default,
  // so re-authenticate explicitly rather than assume the cookie is live).
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(otherEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/library/);

  await page.goto(`/library/prompts/${promptSlug}/edit`);
  await expect(page).toHaveURL(new RegExp(`/library/prompts/${promptSlug}/edit$`));
  await expect(page.getByRole("heading", { name: "Edit prompt" })).toBeVisible();
});

test("category filtering narrows the browse grid", async ({ page }) => {
  await page.goto("/library/prompts");
  await page.getByRole("button", { name: /Backend/ }).first().click();
  await expect(page).toHaveURL(/category=backend/);
  await expect(page.getByRole("heading", { name: promptTitle })).toBeVisible();
});

test("tag filtering narrows the browse grid", async ({ page }) => {
  await page.goto("/library/prompts");
  await page.getByRole("button", { name: "e2e-test" }).first().click();
  await expect(page).toHaveURL(/tags=e2e-test/);
  await expect(page.getByRole("heading", { name: promptTitle })).toBeVisible();
});
