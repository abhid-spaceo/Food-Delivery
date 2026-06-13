import { expect, test } from "@playwright/test";

// Restaurant fulfillment happy path: accept -> start preparing -> out for
// delivery -> mark delivered, driven entirely through the UI.
//
// Seeded accounts (password123): owner@demo.test owns "Mario's Pizza" (APPROVED).
//
// PRECONDITION (merge note): the queue only shows orders once a PAID order
// exists. The seed creates NO orders, and checkout (which flips Payment -> PAID
// via the Stripe webhook) lives in the customer slice, not this worktree. So
// this test needs a paid order in the DB before it can pass. Run it after the
// customer checkout flow has produced at least one PAID order for Mario's Pizza.
//
// NOT covered: the payment gate itself (unpaid orders never appearing),
// role-isolation negatives, menu/profile CRUD, and concurrent advances.

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("owner@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/restaurant");
}

test("owner advances a paid order accept -> prepare -> deliver", async ({ page }) => {
  await signInAsOwner(page);

  // The New column lists paid PLACED orders. Open the first one.
  const newColumn = page.locator("section", { hasText: "New" }).first();
  await expect(newColumn).toBeVisible();

  const firstOpen = newColumn.getByRole("link", { name: "Open" }).first();
  // If there is no paid order yet this will time out — see PRECONDITION above.
  await firstOpen.click();
  await expect(page).toHaveURL(/\/restaurant\/orders\/.+/);

  // PLACED -> show Accept + Reject; click Accept.
  await expect(page.getByText("Placed")).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Accepted")).toBeVisible();

  // ACCEPTED -> Start preparing.
  await page.getByRole("button", { name: "Start preparing" }).click();
  await expect(page.getByText("Preparing")).toBeVisible();

  // PREPARING -> Out for delivery.
  await page.getByRole("button", { name: "Out for delivery" }).click();
  await expect(page.getByText("Out for delivery")).toBeVisible();

  // OUT_FOR_DELIVERY -> Mark delivered (terminal).
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(page.getByText("Delivered")).toBeVisible();
  await expect(
    page.getByText("No further actions for this order."),
  ).toBeVisible();
});
