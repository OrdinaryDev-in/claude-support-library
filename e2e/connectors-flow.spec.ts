import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The Connectors counterpart to e2e/skills-flow.spec.ts — same journey
 * (signup → create → a stranger is genuinely RLS-denied while pending →
 * promoting to admin lifts it → admin approves/rejects from the review
 * queue → a third account can view but not edit → category/tag
 * filtering), against `/library/connectors` and `/admin/review/connectors`
 * instead of Skills' routes. See core-flows.spec.ts's own comments for
 * the reasoning behind each pattern reused here — not re-explained per
 * line here to avoid drift between the files' comments.
 */
test.describe.configure({ mode: "serial" });

const run = Date.now();
let ownerEmail = `e2e-connector-owner-${run}@example.com`;
let otherEmail = `e2e-connector-other-${run}@example.com`;
let thirdEmail = `e2e-connector-third-${run}@example.com`;
const password = "correct-horse-battery-1";
const connectorTitle = `E2E Test Connector ${run}`;
let connectorSlug = "";
const rejectedConnectorTitle = `E2E Connector Reject Test ${run}`;
let rejectedConnectorSlug = "";

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/library/);
}

test.beforeAll(() => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "e2e/connectors-flow.spec.ts needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "for the local Supabase stack — see .github/workflows/ci.yml's test-e2e job."
    );
  }
});

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
  page.on("response", async (res) => {
    if (res.url().includes("/auth/v1/") && !res.ok()) {
      const body = await res.text().catch(() => "<unreadable body>");
      console.log(`[browser:auth-error] ${res.status()} ${res.url()} — ${body}`);
    }
  });
});

test("sign up creates an account and lands in the library", async ({ page }, testInfo) => {
  if (testInfo.retry > 0) {
    ownerEmail = `e2e-connector-owner-${run}-r${testInfo.retry}@example.com`;
    otherEmail = `e2e-connector-other-${run}-r${testInfo.retry}@example.com`;
    thirdEmail = `e2e-connector-third-${run}-r${testInfo.retry}@example.com`;
  }
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Doe").fill("E2E Connector Owner");
  await page.getByPlaceholder("you@company.com").fill(ownerEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  try {
    await expect(page).toHaveURL(/\/library/);
  } catch (err) {
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "<page text unreadable>");
    console.log(`[browser:page-state-on-failure] ${bodyText.replace(/\s+/g, " ").trim().slice(0, 500)}`);
    throw err;
  }
});

test("owner can create a connector", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(ownerEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/library/);

  await page.goto("/library/connectors/new");
  await page.getByPlaceholder(/Wire Up the GitHub MCP Server/).fill(connectorTitle);
  await page.getByPlaceholder("One sentence — what this connector gets you").fill("Created by the E2E suite.");
  await page.getByRole("radio", { name: "MCP Server Setup" }).click();
  await page.getByPlaceholder("mcp, github, api").fill("e2e-test");
  await page.getByPlaceholder("The install/config walkthrough").fill("Do the test setup.");
  await page.getByPlaceholder(/an MCP server entry or API client boilerplate/).fill("{}");
  await page.getByPlaceholder(/Rate limits, auth scopes/).fill("None.");
  await page.getByPlaceholder("[LINK: official docs]").fill("[LINK: test docs]");
  await page.getByRole("button", { name: "Publish connector" }).click();

  await expect(page.getByRole("heading", { name: connectorTitle })).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/library\/connectors\/(?!new$)[^/]+$/);
  connectorSlug = new URL(page.url()).pathname.split("/").pop()!;
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
});

test("a different signed-in account can't see the still-pending connector at all — 404, not just UI-hidden", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Doe").fill("E2E Connector Other");
  await page.getByPlaceholder("you@company.com").fill(otherEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/library/);

  await page.goto(`/library/connectors/${connectorSlug}`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await page.goto(`/library/connectors/${connectorSlug}/edit`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("promoting that account to admin lifts the denial", async ({ page }) => {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error } = await admin.from("profiles").update({ role: "admin" }).eq("email", otherEmail);
  expect(error).toBeNull();

  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(otherEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/library/);

  await page.goto(`/library/connectors/${connectorSlug}/edit`);
  await expect(page).toHaveURL(new RegExp(`/library/connectors/${connectorSlug}/edit$`), { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Edit connector" })).toBeVisible({ timeout: 10_000 });
});

test("admin approves the pending connector from the review queue", async ({ page }) => {
  await login(page, otherEmail);

  await page.goto(`/admin/review/connectors/${connectorSlug}`);
  await expect(page.getByRole("heading", { name: connectorTitle })).toBeVisible();
  await expect(page.getByText("Pending Review")).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/\/admin\/review\/connectors$/);

  await page.goto(`/library/connectors/${connectorSlug}`);
  await expect(page.getByText("Pending Review")).toHaveCount(0);
});

test("a third account can see the now-approved connector but is still denied editing it — redirected, not just UI-hidden", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Doe").fill("E2E Connector Third");
  await page.getByPlaceholder("you@company.com").fill(thirdEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/library/);

  await page.goto(`/library/connectors/${connectorSlug}`);
  await expect(page.getByRole("heading", { name: connectorTitle })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  await page.goto(`/library/connectors/${connectorSlug}/edit`);
  await expect(page).toHaveURL(new RegExp(`/library/connectors/${connectorSlug}$`));
});

test("owner submits a second connector and admin rejects it with a reason", async ({ page }) => {
  await login(page, ownerEmail);

  await page.goto("/library/connectors/new");
  await page.getByPlaceholder(/Wire Up the GitHub MCP Server/).fill(rejectedConnectorTitle);
  await page
    .getByPlaceholder("One sentence — what this connector gets you")
    .fill("Also created by the E2E suite — expected to be rejected.");
  await page.getByRole("radio", { name: "MCP Server Setup" }).click();
  await page.getByPlaceholder("mcp, github, api").fill("e2e-test");
  await page.getByPlaceholder("The install/config walkthrough").fill("Do the test setup.");
  await page.getByPlaceholder(/an MCP server entry or API client boilerplate/).fill("{}");
  await page.getByPlaceholder(/Rate limits, auth scopes/).fill("None.");
  await page.getByPlaceholder("[LINK: official docs]").fill("[LINK: test docs]");
  await page.getByRole("button", { name: "Publish connector" }).click();

  await expect(page.getByRole("heading", { name: rejectedConnectorTitle })).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/library\/connectors\/(?!new$)[^/]+$/);
  rejectedConnectorSlug = new URL(page.url()).pathname.split("/").pop()!;

  await login(page, otherEmail);
  await page.goto(`/admin/review/connectors/${rejectedConnectorSlug}`);
  await page.getByRole("button", { name: "Reject" }).click();
  await page
    .getByPlaceholder(/Overlaps with an existing connector/)
    .fill("Not a fit for the library — e2e test.");
  await page.getByRole("button", { name: "Reject" }).last().click();
  await expect(page).toHaveURL(/\/admin\/review\/connectors\?status=rejected$/);

  await login(page, ownerEmail);
  await page.goto(`/library/connectors/${rejectedConnectorSlug}`);
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await expect(page.getByText("Not a fit for the library — e2e test.")).toBeVisible();
});

test("category filtering narrows the browse grid", async ({ page }) => {
  await login(page, ownerEmail);
  await page.goto("/library/connectors");
  await page.getByRole("button", { name: /MCP Server Setup/ }).first().click();
  await expect(page).toHaveURL(/category=mcp_server_setup/);
  await expect(page.getByRole("heading", { name: connectorTitle })).toBeVisible();
});

test("tag filtering narrows the browse grid", async ({ page }) => {
  await login(page, ownerEmail);
  await page.goto("/library/connectors");
  await page.getByRole("button", { name: "e2e-test" }).first().click();
  await expect(page).toHaveURL(/tags=e2e-test/);
  await expect(page.getByRole("heading", { name: connectorTitle })).toBeVisible();
});
