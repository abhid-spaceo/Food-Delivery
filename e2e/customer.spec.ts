import { expect, test } from "@playwright/test";

// Customer demand side (Phase 2): discover -> cart -> checkout -> stub-pay ->
// the order becomes visible to the restaurant and advances on a live timeline.
// Plus negatives: ownership 404, cancel-before-accept, single-restaurant conflict.
//
// Seeded (password123): customer@demo.test (Maya), owner@demo.test (Mario's Pizza,
// APPROVED: Margherita $9.00, Pepperoni $11.00), owner2@demo.test (Spice Hub).
// PRECONDITION: pnpm prisma migrate dev && pnpm db:seed.
//
// NOT covered: real Stripe (Phase 4), driver claim/deliver (Phase 3),
// multi-address book (Phase 5).

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function addMargheritaToCart(page: import("@playwright/test").Page) {
  await page.goto("/browse");
  await page.getByRole("link", { name: "Mario's Pizza" }).click();
  await expect(page).toHaveURL(/\/restaurants\/.+/);
  // Add one Margherita (the first item's Add button).
  const row = page.locator("text=Margherita").locator("xpath=ancestor::*[self::div][1]");
  await page.getByRole("button", { name: "Add" }).first().click();
}

// Happy path: place + pay + see it advance.
test("customer places an order, pays (stub), and tracks it to READY", async ({ page }) => {
  await signIn(page, "customer@demo.test");
  await expect(page).toHaveURL("/browse");

  await addMargheritaToCart(page);

  await page.getByRole("link", { name: "Cart" }).click();
  await expect(page).toHaveURL("/cart");
  await expect(page.getByText("Total")).toBeVisible();

  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await expect(page).toHaveURL("/checkout");

  await page.getByLabel("Delivery address").fill("12 MG Road, Bengaluru");
  await page.getByRole("button", { name: "Place order" }).click();

  // Lands on the order tracking page, payment pending.
  await expect(page).toHaveURL(/\/orders\/.+/);
  const orderUrl = page.url();
  await expect(page.getByRole("button", { name: "Mark as paid (dev)" })).toBeVisible();

  // Pay (stub). Pending card disappears; status is Placed.
  await page.getByRole("button", { name: "Mark as paid (dev)" }).click();
  await expect(page.getByRole("button", { name: "Mark as paid (dev)" })).toHaveCount(0);
  await expect(page.getByTestId("current-status")).toContainText("Placed");

  // Restaurant now sees the paid order and advances it to READY.
  await signIn(page, "owner@demo.test");
  await expect(page).toHaveURL("/restaurant");
  const newColumn = page.locator("section", { hasText: "New" }).first();
  await newColumn.getByRole("link", { name: "Open" }).first().click();
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("button", { name: "Start preparing" }).click();
  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();

  // Back on the customer's tracking page: the timeline reflects READY (polling).
  await signIn(page, "customer@demo.test");
  await page.goto(orderUrl);
  await expect(page.getByTestId("current-status")).toContainText("Ready", { timeout: 10_000 });
});

// Negative: a customer cannot open an order that isn't theirs (unknown id -> 404).
test("ownership: unknown order id renders not-found", async ({ page }) => {
  await signIn(page, "customer@demo.test");
  await page.goto("/orders/does-not-exist-id");
  await expect(page.getByText(/not found|404|This page could not be found/i)).toBeVisible();
});

// Negative: cancel is allowed only before acceptance (while PLACED).
test("customer can cancel an order while it is still PLACED", async ({ page }) => {
  await signIn(page, "customer@demo.test");
  await addMargheritaToCart(page);
  await page.goto("/checkout");
  await page.getByLabel("Delivery address").fill("9 Cancel Street, Bengaluru");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/.+/);

  page.on("dialog", (d) => d.accept()); // confirm() -> OK
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByTestId("current-status")).toContainText("Cancelled");
});

// Negative: single-restaurant cart — adding from a second restaurant prompts to
// replace; declining keeps the original cart.
test("single-restaurant cart: declining the replace prompt keeps the first item", async ({
  page,
}) => {
  await signIn(page, "customer@demo.test");
  await addMargheritaToCart(page); // Mario's

  // Go to Spice Hub and try to add — decline the confirm.
  page.once("dialog", (d) => d.dismiss()); // confirm() -> Cancel
  await page.goto("/browse");
  await page.getByRole("link", { name: "Spice Hub" }).click();
  await page.getByRole("button", { name: "Add" }).first().click();

  // Cart still has 1 item (Mario's Margherita), not replaced.
  await page.getByRole("link", { name: "Cart" }).click();
  await expect(page.getByText("Mario's Pizza")).toBeVisible();
});
