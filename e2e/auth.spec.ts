import { expect, test } from "@playwright/test";

// Auth happy/sad paths. Uses seeded accounts (password123):
//   admin@demo.test (ADMIN), owner@demo.test (RESTAURANT), customer@demo.test (CUSTOMER)

test("rejects invalid credentials with an error message", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("customer@demo.test");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL(/\/signin/);
});

test("customer signs in and lands on /browse", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("customer@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/browse");
  await expect(page.getByText("customer@demo.test")).toBeVisible();
});

test("admin signs in, lands on /admin, and can sign out", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("admin@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/admin");
  await expect(page.getByText("admin@demo.test")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
});

test("proxy redirects an unauthenticated user from /admin to /signin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/signin/);
});

test("role gating: a customer cannot reach /admin", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("customer@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/browse");

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/signin/); // bounced by the proxy
});
