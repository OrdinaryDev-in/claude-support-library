import type { Page } from "@playwright/test";

/** A fresh, unique test identity per call so specs never collide and
 * don't need a `supabase db reset` between runs. */
export function uniqueTestUser() {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    email: `e2e-${id}@example.com`,
    password: `TestPass!${id}`,
    fullName: `E2E Test ${id}`,
  };
}

/** Drives the real signup form (components/auth/AuthForm.tsx). Requires
 * "Confirm email" disabled on the local Supabase project (README's local
 * dev setup step) so the session is established immediately. */
export async function signUp(
  page: Page,
  user: { email: string; password: string; fullName: string }
) {
  await page.goto("/signup");
  await page.getByPlaceholder("Jane Doe").fill(user.fullName);
  await page.getByPlaceholder("you@company.com").fill(user.email);
  await page.getByPlaceholder("••••••••").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/library");
}

export async function signIn(
  page: Page,
  user: { email: string; password: string }
) {
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill(user.email);
  await page.getByPlaceholder("••••••••").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/library");
}
