import { expect, test } from "@playwright/test";

// Phase 5b gating tests:
//   1. Closed-store gate: owner closes store -> customer cannot place order
//      -> owner reopens -> flow unblocked.
//   2. Offline-driver gate: driver goes offline -> Claim button hidden ->
//      driver goes online -> Claim button shown.
//
// Seeded (password123):
//   owner@demo.test (Mario's Pizza, APPROVED, isAcceptingOrders=true by default)
//   customer@demo.test (Maya)
//   driver@demo.test (Dev, APPROVED, isOnline=true by seeding)
//
// PRECONDITION: pnpm prisma migrate dev && pnpm db:seed
//
// NOT covered: actual delivery after claiming (covered by driver.spec.ts),
// Stripe real payment, multi-restaurant scenarios for closed-gate.

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/signin"));
}

// Add Margherita to cart while the restaurant is open; returns the restaurant URL.
async function addMargheritaToCart(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/browse");
  await page.getByRole("link", { name: "Mario's Pizza" }).click();
  await expect(page).toHaveURL(/\/restaurants\/.+/);
  const restaurantUrl = page.url();
  await page.getByRole("button", { name: "Add" }).first().click();
  await expect(page.getByRole("link", { name: "Cart" })).toContainText("1");
  return restaurantUrl;
}

// ── Closed-store gate ──────────────────────────────────────────────────────────

test("owner closes store; customer cannot place order; owner reopens; order goes through", async ({
  page,
}) => {
  // Single page, re-authenticating between roles — one browser context shares one
  // session cookie, so a second page signed in as another role would clobber it.

  // 1) Owner closes the store (toggle reads "Close store" when open).
  await signIn(page, "owner@demo.test");
  await page.goto("/restaurant/profile");
  await expect(page.getByRole("button", { name: "Close store" })).toBeVisible();
  await page.getByRole("button", { name: "Close store" }).click();
  await expect(page.getByRole("button", { name: "Open store" })).toBeVisible();

  // 2) Customer sees the closed state — the "not accepting" note, no Add buttons.
  await signIn(page, "customer@demo.test");
  await page.goto("/browse");
  await page.getByRole("link", { name: "Mario's Pizza" }).click();
  await expect(page).toHaveURL(/\/restaurants\/.+/);
  await expect(page.getByText("Currently not accepting orders").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add" })).toHaveCount(0);

  // 3) Owner reopens the store.
  await signIn(page, "owner@demo.test");
  await page.goto("/restaurant/profile");
  await expect(page.getByRole("button", { name: "Open store" })).toBeVisible();
  await page.getByRole("button", { name: "Open store" }).click();
  await expect(page.getByRole("button", { name: "Close store" })).toBeVisible();

  // 4) Customer can add again.
  await signIn(page, "customer@demo.test");
  await page.goto("/browse");
  await page.getByRole("link", { name: "Mario's Pizza" }).click();
  await expect(page.getByRole("button", { name: "Add" }).first()).toBeVisible();
});

// ── Offline-driver gate ────────────────────────────────────────────────────────

test("driver goes offline; Claim button hidden; driver goes online; Claim button shown", async ({
  page,
}) => {
  // Seed guarantees driver@demo.test is APPROVED and isOnline=true.
  await signIn(page, "driver@demo.test");
  await expect(page).toHaveURL("/driver/pool");

  // Open the first READY order.
  await page.getByRole("link", { name: "View & claim" }).first().click();
  await expect(page).toHaveURL(/\/driver\/order\/.+/);
  const orderUrl = page.url();

  // Confirm Claim button is visible while online.
  await expect(page.getByRole("button", { name: "Claim this order" })).toBeVisible();

  // Toggle offline via the pill in the driver shell header.
  await page.getByRole("button", { name: "Online" }).click();
  // Pill now shows "Offline".
  await expect(page.getByRole("button", { name: "Offline" })).toBeVisible();

  // Reload the order page — Claim button must be gone; "go online" note shown.
  await page.goto(orderUrl);
  await expect(page.getByRole("button", { name: "Claim this order" })).toHaveCount(0);
  await expect(page.getByText("Go online to claim this order.")).toBeVisible();

  // Toggle back online.
  await page.getByRole("button", { name: "Offline" }).click();
  await expect(page.getByRole("button", { name: "Online" })).toBeVisible();

  // Reload — Claim button is visible again.
  await page.goto(orderUrl);
  await expect(page.getByRole("button", { name: "Claim this order" })).toBeVisible();
});
