import { expect, test } from "@playwright/test";
import { signIn, signUp, uniqueTestUser } from "./helpers";

test("unauthenticated visitors are redirected to /login", async ({ page }) => {
  await page.goto("/library");
  await expect(page).toHaveURL(/\/login/);
});

test("sign up creates an account and lands on /library", async ({ page }) => {
  const user = uniqueTestUser();
  await signUp(page, user);
  await expect(page).toHaveURL(/\/library/);
});

test("sign in with an existing account lands on /library", async ({ page }) => {
  const user = uniqueTestUser();
  await signUp(page, user);

  // Sign out (NavBar) and back in to exercise the login path distinctly
  // from the post-signup session.
  await page.goto("/account");
  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);

  await signIn(page, user);
  await expect(page).toHaveURL(/\/library/);
});
