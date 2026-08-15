import { expect, test } from "@playwright/test";
import { signUp, uniqueTestUser } from "./helpers";

test("create, edit, and delete a prompt through the real UI", async ({ page }) => {
  await signUp(page, uniqueTestUser());

  const title = `E2E Prompt ${Date.now()}`;
  const editedTitle = `${title} (edited)`;

  // ── Create ──────────────────────────────────────────────────────
  await page.goto("/library/prompts/new");
  await page.getByPlaceholder(/Add Rate Limiting/).fill(title);
  await page.getByPlaceholder(/one sentence/i).fill("An end-to-end test prompt.");
  await page.getByPlaceholder("[BRACKETED PLACEHOLDERS]").fill("Fill in your stack.");
  await page.getByPlaceholder(/AI role and task-type framing/i).fill("Build a thing.");
  await page.getByPlaceholder(/LINKS\/DESCRIPTIONS OF PRIOR WORK/).fill("Point at a similar project.");
  await page.getByPlaceholder("[CLOUD/DOCS LINKS]").fill("Link the docs.");
  await page.getByPlaceholder(/correct AI response/i).fill("Expect a working server.");
  await page.getByRole("button", { name: "Publish prompt" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // ── Appears in the browse grid ─────────────────────────────────
  await page.goto("/library/prompts");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // ── Edit ─────────────────────────────────────────────────────────
  await page.getByRole("heading", { name: title }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  const titleInput = page.getByPlaceholder(/Add Rate Limiting/);
  await titleInput.fill(editedTitle);
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: editedTitle })).toBeVisible();

  // ── Delete (with the 5s undo window) ────────────────────────────
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Deleted")).toBeVisible();
  await page.waitForURL("**/library/prompts", { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: editedTitle })).toHaveCount(0);
});
