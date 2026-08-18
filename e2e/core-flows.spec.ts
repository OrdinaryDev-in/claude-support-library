import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Covers the flows README.md's "Verifying it works" section describes as
 * a manual QA pass: signup, login, create a prompt, a second account
 * being genuinely RLS-denied (not just UI-hidden) from even seeing it
 * while it's pending review, that denial lifting once promoted to admin,
 * the prompt review workflow itself (approve from the queue, reject with
 * a reason the author then sees — 20260816090111_prompt_review_workflow.sql), a
 * third account still being denied editing once the prompt is approved
 * and visible, and category/tag filtering.
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
// otherEmail gets promoted to admin partway through (see "promoting that
// account to admin lifts the denial") and stays admin for the rest of the
// suite — a third, never-promoted account is what actually exercises "a
// stranger can't edit someone else's prompt" once the prompt is approved.
let thirdEmail = `e2e-third-${run}@example.com`;
const password = "correct-horse-battery-1";
const promptTitle = `E2E Test Prompt ${run}`;
let promptSlug = "";
// A second prompt, used only by the reject flow — the first one gets
// approved and is needed in its approved state by the filtering tests
// below, so rejection needs its own row rather than reusing promptSlug.
const rejectedPromptTitle = `E2E Reject Test ${run}`;
let rejectedPromptSlug = "";

/** Logs in as `email` and waits for the redirect to /library. Clears
 * cookies first: proxy.ts (lib/supabase/middleware.ts) redirects an
 * already-authenticated session straight past /login to /library before
 * the form ever renders, so calling this a second time *within the same
 * test* to switch identity (owner → admin → owner again, e.g. "owner
 * submits a second prompt and admin rejects it with a reason" below)
 * would otherwise silently no-op — still signed in as whoever logged in
 * first, hanging on a login form that never appears. Playwright also
 * doesn't guarantee a session survives *across* separate test() blocks in
 * serial mode, so every test that needs a specific identity calls this
 * rather than assuming a cookie is still live either way. */
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
  // None of the three hooks above fire for this: Supabase Auth rejecting
  // a request (bad password, disallowed redirect, rate limit, whatever)
  // is a completed HTTP response with a non-2xx status, not a network
  // failure — and AuthForm.tsx never console.errors on it, just sets
  // component state. That's the one class of failure the hooks above are
  // structurally blind to, and it's exactly the shape a rejected
  // signup/login takes. This is the only way to see what Auth actually
  // said, short of pulling down trace.zip by hand.
  page.on("response", async (res) => {
    if (res.url().includes("/auth/v1/") && !res.ok()) {
      const body = await res.text().catch(() => "<unreadable body>");
      console.log(`[browser:auth-error] ${res.status()} ${res.url()} — ${body}`);
    }
  });
});

test("sign up creates an account and lands in the library", async ({ page }, testInfo) => {
  if (testInfo.retry > 0) {
    ownerEmail = `e2e-owner-${run}-r${testInfo.retry}@example.com`;
    otherEmail = `e2e-other-${run}-r${testInfo.retry}@example.com`;
    thirdEmail = `e2e-third-${run}-r${testInfo.retry}@example.com`;
  }
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Doe").fill("E2E Owner");
  await page.getByPlaceholder("you@company.com").fill(ownerEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Local stack has email confirmation disabled (supabase/config.toml
  // [auth.email] enable_confirmations = false) so this lands in the app
  // directly, no inbox to check.
  try {
    await expect(page).toHaveURL(/\/library/);
  } catch (err) {
    // A 2xx signup response with no session (confirmation silently still
    // required despite enable_confirmations=false) wouldn't show up as an
    // [browser:auth-error] above either — it's not an error response at
    // all. Whatever AuthForm actually rendered instead of redirecting
    // (the "Almost there, confirm your account..." text, or a rendered
    // {error} message) is the ground truth here, so dump it directly.
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "<page text unreadable>");
    console.log(`[browser:page-state-on-failure] ${bodyText.replace(/\s+/g, " ").trim().slice(0, 500)}`);
    throw err;
  }
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
  // The category picker is a role="radiogroup"/role="radio" set
  // (components/prompts/PromptForm.tsx), not plain buttons — distinct
  // from the "Backend" *filter* button on /library/prompts (LibraryFilters,
  // still a real <button>, see "category filtering narrows the browse
  // grid" below).
  await page.getByRole("radio", { name: "Backend" }).click();
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

  // Wait for a signal that can ONLY be true on the real detail page
  // first, before touching the URL at all: /\/library\/prompts\/[^/]+$/
  // looks like it only matches the new prompt's slug, but [^/]+ also
  // matches the literal word "new" — so it was trivially already
  // satisfied by the *form's own URL* (/library/prompts/new) the instant
  // this assertion started polling, before the real post-submit redirect
  // ever happened. That silently captured promptSlug = "new" below (not
  // a real prompt), which then made the next test's "denied editing it"
  // check fail for a completely different reason than intended — it hit
  // a genuine 404 on /library/prompts/new/edit, since no prompt has that
  // slug. The heading is unambiguous: it only renders on the created
  // prompt's own detail page.
  await expect(page.getByRole("heading", { name: promptTitle })).toBeVisible({ timeout: 10_000 });
  // Negative lookahead as defense in depth, now that ordering alone
  // already fixes the real bug — belt and suspenders against the exact
  // same trap recurring here or anywhere this pattern gets copied.
  await expect(page).toHaveURL(/\/library\/prompts\/(?!new$)[^/]+$/);
  promptSlug = new URL(page.url()).pathname.split("/").pop()!;
  // Owner sees edit controls.
  await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();
});

test("a different signed-in account can't see the still-pending prompt at all — 404, not just UI-hidden", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Doe").fill("E2E Other");
  await page.getByPlaceholder("you@company.com").fill(otherEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/library/);

  // The prompt from "owner can create a prompt" is still pending_review —
  // prompts_select_signed_in (20260816090111_prompt_review_workflow.sql) only lets a
  // signed-in stranger see status = 'approved' rows, so a non-owner,
  // non-admin account doesn't just lack edit controls here, the row is
  // invisible to it entirely: both the detail and edit routes hit the
  // app's own notFound() call (supabase .single() returns no row once RLS
  // filters it out) rather than the edit page's redirect-on-no-permission
  // branch ever being reached. Asserting on the rendered not-found content
  // rather than response.status() — confirmed via a captured page
  // snapshot that this Next.js version renders the real not-found UI here
  // (heading "Page not found" — app/not-found.tsx's own copy, not Next's
  // built-in default) while still returning HTTP 200 on page.goto()'s
  // response for the initial navigation, so status() isn't the reliable
  // signal for this check.
  await page.goto(`/library/prompts/${promptSlug}`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  await page.goto(`/library/prompts/${promptSlug}/edit`);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
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

  // The edit page's server component does 4 sequential DB round-trips
  // before it can render anything (getUser, select prompts, select
  // profiles for the admin check, select+join prompt_tags) — the
  // heaviest single page load in this suite, and observed timing out at
  // the default 5s under CI resource contention (matches this file's
  // existing precedent: the post-submit assertion in "owner can create a
  // prompt" above already uses a 10s timeout for the same reason).
  await page.goto(`/library/prompts/${promptSlug}/edit`);
  await expect(page).toHaveURL(new RegExp(`/library/prompts/${promptSlug}/edit$`), { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Edit prompt" })).toBeVisible({ timeout: 10_000 });
});

test("admin approves the pending prompt from the review queue", async ({ page }) => {
  // otherEmail was promoted to admin in the previous test — reused here
  // as the reviewer rather than a third throwaway account.
  await login(page, otherEmail);

  // New prompts start pending_review, not live (20260816090111_prompt_review_workflow.sql)
  // — the owner's prompt from "owner can create a prompt" has been sitting
  // unapproved this whole time, invisible to the public Browse grid even
  // though this account is an admin.
  await page.goto(`/admin/review/${promptSlug}`);
  await expect(page.getByRole("heading", { name: promptTitle })).toBeVisible();
  await expect(page.getByText("Pending Review")).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/\/admin\/review$/);

  // The detail page's own pill is the ground truth that the approval
  // actually landed in the database, not just that the button click
  // navigated somewhere.
  await page.goto(`/library/prompts/${promptSlug}`);
  await expect(page.getByText("Pending Review")).toHaveCount(0);
});

test("a third account can see the now-approved prompt but is still denied editing it — redirected, not just UI-hidden", async ({
  page,
}) => {
  // otherEmail is spent as the admin account by this point, so this is a
  // fresh identity — the original "stranger can't edit someone else's
  // prompt" property (distinct from the previous test's "can't even see a
  // pending one"), now checked against a prompt that's actually visible.
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Doe").fill("E2E Third");
  await page.getByPlaceholder("you@company.com").fill(thirdEmail);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/library/);

  await page.goto(`/library/prompts/${promptSlug}`);
  await expect(page.getByRole("heading", { name: promptTitle })).toBeVisible();
  // No edit/delete controls for a non-owner.
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);

  // The real test: navigate straight to the edit URL, bypassing the
  // hidden button entirely. app/(app)/library/prompts/[slug]/edit/page.tsx
  // redirects non-owner/non-admin back to the detail page server-side.
  await page.goto(`/library/prompts/${promptSlug}/edit`);
  await expect(page).toHaveURL(new RegExp(`/library/prompts/${promptSlug}$`));
});

test("owner submits a second prompt and admin rejects it with a reason", async ({ page }) => {
  await login(page, ownerEmail);

  await page.goto("/library/prompts/new");
  await page.getByPlaceholder(/Add Rate Limiting/).fill(rejectedPromptTitle);
  await page
    .getByPlaceholder("One sentence — what this prompt gets you")
    .fill("Also created by the E2E suite — expected to be rejected.");
  await page.getByRole("radio", { name: "Backend" }).click();
  await page.getByPlaceholder("api, postgres, auth").fill("e2e-test");
  await page.getByPlaceholder("AI role and task-type framing").fill("You are a test.");
  await page.getByPlaceholder("[BRACKETED PLACEHOLDERS]").fill("[FIELD]");
  await page.getByPlaceholder("[LINKS/DESCRIPTIONS OF PRIOR WORK]").fill("[NONE]");
  await page.getByPlaceholder("[CLOUD/DOCS LINKS]").fill("[NONE]");
  await page
    .getByPlaceholder("What a correct AI response must include")
    .fill("Nothing in particular.");
  await page.getByRole("button", { name: "Publish prompt" }).click();

  // Same ordering rationale as "owner can create a prompt" above: the
  // heading only renders on the created prompt's own detail page, so
  // check it before trusting the URL.
  await expect(page.getByRole("heading", { name: rejectedPromptTitle })).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/library\/prompts\/(?!new$)[^/]+$/);
  rejectedPromptSlug = new URL(page.url()).pathname.split("/").pop()!;

  await login(page, otherEmail);
  await page.goto(`/admin/review/${rejectedPromptSlug}`);
  await page.getByRole("button", { name: "Reject" }).click(); // opens the reason modal
  await page
    .getByPlaceholder(/Overlaps with an existing prompt/)
    .fill("Not a fit for the library — e2e test.");
  // Two "Reject" buttons exist once the modal is open: the action bar's
  // (still rendered — the prompt is still pending_review until this
  // submits) and the modal's own submit button, which is the later one in
  // DOM order.
  await page.getByRole("button", { name: "Reject" }).last().click();
  await expect(page).toHaveURL(/\/admin\/review\?status=rejected$/);

  // The author sees the rejection and the reason on their own submission
  // — the one place a non-approved prompt is visible to anyone but an
  // admin (RLS: prompts_select_signed_in).
  await login(page, ownerEmail);
  await page.goto(`/library/prompts/${rejectedPromptSlug}`);
  // exact: true — the prompt's own description text ("...expected to be
  // rejected.") would otherwise also match a plain substring search for
  // "Rejected", same word, different casing.
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await expect(page.getByText("Not a fit for the library — e2e test.")).toBeVisible();
});

test("category filtering narrows the browse grid", async ({ page }) => {
  // These two tests never authenticated anyone themselves — they always
  // relied on a session surviving from whichever test happened to run
  // immediately before. That's exactly the assumption every other test in
  // this file explicitly re-authenticates rather than makes (see login()'s
  // own doc comment above), and it broke here the moment "owner submits a
  // second prompt and admin rejects it with a reason" (this file's own
  // last identity-switch) ended on a *different* account than these two
  // ever expected — /library/prompts requires a session at all
  // (lib/supabase/middleware.ts), so with no session the redirect-to-
  // /login page's own "Backend" filter button just doesn't exist.
  await login(page, ownerEmail);
  await page.goto("/library/prompts");
  await page.getByRole("button", { name: /Backend/ }).first().click();
  await expect(page).toHaveURL(/category=backend/);
  await expect(page.getByRole("heading", { name: promptTitle })).toBeVisible();
});

test("tag filtering narrows the browse grid", async ({ page }) => {
  await login(page, ownerEmail);
  await page.goto("/library/prompts");
  await page.getByRole("button", { name: "e2e-test" }).first().click();
  await expect(page).toHaveURL(/tags=e2e-test/);
  await expect(page.getByRole("heading", { name: promptTitle })).toBeVisible();
});
