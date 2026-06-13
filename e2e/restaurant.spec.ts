import { expect, test } from "@playwright/test";

// Restaurant fulfillment happy path (post-Phase-1): accept -> start preparing
// -> mark ready, driven through the UI. The restaurant can NO LONGER mark an
// order out-for-delivery or delivered — that is the driver's leg.
//
// Seeded accounts (password123): owner@demo.test owns "Mario's Pizza"
// (APPROVED). The seed creates one PAID PLACED order for it, so the New column
// is non-empty.
//
// PRECONDITION: run `pnpm prisma migrate dev` and `pnpm db:seed` first.
//
// NOT covered: the payment gate (unpaid orders never appearing), the driver
// claim/deliver leg, role-isolation negatives, menu/profile CRUD.

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("owner@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/restaurant");
}

test("owner advances a paid order accept -> prepare -> ready", async ({ page }) => {
  await signInAsOwner(page);

  // The New column lists paid PLACED orders. Open the first one.
  const newColumn = page.locator("section", { hasText: "New" }).first();
  await expect(newColumn).toBeVisible();

  const firstOpen = newColumn.getByRole("link", { name: "Open" }).first();
  await firstOpen.click();
  await expect(page).toHaveURL(/\/restaurant\/orders\/.+/);

  // PLACED -> show Accept + Reject; click Accept.
  await expect(page.getByText("Placed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();

  // ACCEPTED -> Start preparing.
  await page.getByRole("button", { name: "Start preparing" }).click();
  await expect(page.getByText("Preparing", { exact: true })).toBeVisible();

  // PREPARING -> Mark ready (the restaurant's last legal step).
  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();

  // The delivery leg is driver-only, so the restaurant sees no more actions.
  await expect(
    page.getByText("No further actions for this order."),
  ).toBeVisible();
});
