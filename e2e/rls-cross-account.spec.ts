import { expect, test } from "@playwright/test";
import { signUp, uniqueTestUser } from "./helpers";

// Automates the two-account check README's "Verifying it works" section
// currently describes as a manual step: confirms a non-owner is blocked
// through the real UI, not just that the app hides an Edit/Delete
// button. The deeper layers this UI guard sits on top of —
// isAuthorOrAdmin() rejecting a non-owner/non-admin, and RLS rejecting
// the write even if the app-layer check were bypassed — are covered by
// lib/auth/require-user.test.ts and the migration history
// (supabase/migrations/0002-0007), not re-derived here through the
// browser.
test("a second account cannot reach another user's prompt edit page", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signUp(ownerPage, uniqueTestUser());

  const title = `RLS Test Prompt ${Date.now()}`;
  await ownerPage.goto("/library/prompts/new");
  await ownerPage.getByPlaceholder(/Add Rate Limiting/).fill(title);
  await ownerPage.getByPlaceholder(/one sentence/i).fill("Owned by account A.");
  await ownerPage.getByPlaceholder(/AI role and task-type framing/i).fill("Task.");
  await ownerPage.getByPlaceholder("[BRACKETED PLACEHOLDERS]").fill("Details.");
  await ownerPage.getByPlaceholder(/LINKS\/DESCRIPTIONS OF PRIOR WORK/).fill("Refs.");
  await ownerPage.getByPlaceholder("[CLOUD/DOCS LINKS]").fill("Links.");
  await ownerPage.getByPlaceholder(/correct AI response/i).fill("Output.");
  await ownerPage.getByRole("button", { name: "Publish prompt" }).click();
  await expect(ownerPage.getByRole("heading", { name: title })).toBeVisible();
  const promptUrl = ownerPage.url();
  const editUrl = `${promptUrl}/edit`;

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await signUp(otherPage, uniqueTestUser());

  // The non-owner sees the prompt (published, readable by any signed-in
  // user) but no Edit/Delete controls.
  await otherPage.goto(promptUrl);
  await expect(otherPage.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(otherPage.getByRole("button", { name: "Delete" })).toHaveCount(0);

  // Hitting the edit URL directly still isn't enough —
  // app/(app)/library/prompts/[slug]/edit/page.tsx checks ownership
  // server-side and redirects a non-owner/non-admin straight back to
  // the detail page before the form ever renders.
  await otherPage.goto(editUrl);
  await expect(otherPage).toHaveURL(promptUrl);

  // Confirm the title genuinely wasn't changed, as the owner sees it.
  await ownerPage.goto(promptUrl);
  await expect(ownerPage.getByRole("heading", { name: title })).toBeVisible();

  await ownerContext.close();
  await otherContext.close();
});
