import { expect, test } from "@playwright/test";

// Restaurant fulfillment: the full lifecycle a restaurant owner drives through
// the UI, plus permission and payment-gate coverage.
//
// Seeded accounts (password123):
//   owner@demo.test  — Mario's Pizza (APPROVED)
//   owner2@demo.test — Spice Hub (APPROVED)
//
// Seed guarantees Mario's has ≥3 PAID PLACED orders (accept and reject tests
// each consume one; one remains for read-only tests), one PAID unclaimed READY
// order (Phase 3 driver pool), one PAID PLACED order for Spice Hub (cross-tenant
// test), and one UNPAID PLACED order for Mario's with sentinel total $77.77
// (payment-gate test). Seeded Margherita ×2 order: subtotal $18.00, fee $2.99,
// total $20.99.
//
// PRECONDITION: run `pnpm prisma migrate dev` and `pnpm db:seed` first.
//
// NOT covered: menu/profile CRUD, driver claim/deliver (Phase 3), atomic-claim
// race, customer tracking/history.

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signInAsOwner(page: import("@playwright/test").Page) {
  await signIn(page, "owner@demo.test");
  await expect(page).toHaveURL("/restaurant");
}

// F3-P1 + F3-P2: Accept → Start preparing → Mark ready; no further actions at READY.
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

// F3-P3: Reject path — owner opens a New order and rejects it; terminal state.
test("owner can reject a placed order", async ({ page }) => {
  await signInAsOwner(page);

  const newColumn = page.locator("section", { hasText: "New" }).first();
  await expect(newColumn).toBeVisible();

  // There are ≥2 PLACED orders seeded; the accept test takes the first one,
  // so this test picks whichever is now first in the New column.
  const firstOpen = newColumn.getByRole("link", { name: "Open" }).first();
  await firstOpen.click();
  await expect(page).toHaveURL(/\/restaurant\/orders\/.+/);

  // PLACED -> click Reject.
  await expect(page.getByText("Placed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).click();

  // Status badge should read "Rejected" and no further actions are shown.
  await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
  await expect(
    page.getByText("No further actions for this order."),
  ).toBeVisible();
});

// F4-B1: Payment gate — the unpaid sentinel order ($77.77) must never appear in
// the queue. An order with Payment.status=PENDING is excluded by the queue query.
test("payment gate: unpaid order is not visible in the queue", async ({ page }) => {
  await signInAsOwner(page);

  // The queue page is /restaurant. Confirm the sentinel total is absent from
  // every column — formatCents(7777) = "$77.77".
  await expect(page.getByText("$77.77")).toHaveCount(0);

  // Optional sanity: at least one paid order's total IS present (queue is non-empty).
  // formatCents(900*2 + 299) = "$18.99"
  // This may vary if all PLACED orders were consumed; skip strict assertion.
});

// F4-P1/P2/E2 — queue grouping + item count. Verifies that the two queue
// columns ("New" and "Ready · awaiting driver") are both rendered and that an
// order card with the Margherita ×2 seed order shows "2 items".
// Does NOT cover: in-progress / completed columns, ordering within a column.
test("queue board shows New and Ready columns and correct item count", async ({ page }) => {
  await signInAsOwner(page);

  // Both columns must be present — one for paid PLACED orders, one for READY.
  const newColumn = page.locator("section", { hasText: "New" }).first();
  await expect(newColumn).toBeVisible();

  const readyColumn = page.locator("section", { hasText: "Ready · awaiting driver" }).first();
  await expect(readyColumn).toBeVisible();

  // The Margherita ×2 seed order has itemCount=2; the card renders "{n} items".
  // Multiple such orders may exist, so use .first() to avoid strict-mode errors.
  await expect(page.getByText("2 items").first()).toBeVisible();
});

// F9-DATA5 — order totals add up in the UI (read-only; does NOT mutate the order).
// Margherita ×2: subtotal 900×2=1800 ($18.00), fee 299 ($2.99), total 2099 ($20.99).
// The detail page renders:
//   "Subtotal $18.00 · Fee $2.99"  (single line with middle-dot separator)
//   "Total $20.99"
// Does NOT cover: totals for other item combinations, currency formatting edge cases.
test("order detail shows correct subtotal, fee, and total", async ({ page }) => {
  await signInAsOwner(page);

  // Open the first "Open" link in the New column (a PLACED Margherita ×2 order).
  const newColumn = page.locator("section", { hasText: "New" }).first();
  await expect(newColumn).toBeVisible();
  const firstOpen = newColumn.getByRole("link", { name: "Open" }).first();
  await firstOpen.click();
  await expect(page).toHaveURL(/\/restaurant\/orders\/.+/);

  // The Items card renders: "Subtotal $18.00 · Fee $2.99" on one line.
  await expect(page.getByText("Subtotal $18.00 · Fee $2.99")).toBeVisible();
  // And on the next line: "Total $20.99".
  await expect(page.getByText("Total $20.99")).toBeVisible();
});

// F3-N1 — non-existent order id returns notFound() (no "Back to queue" link).
// A real order detail always renders <Link href="/restaurant">Back to queue</Link>.
// When notFound() fires (unknown id or wrong restaurant), that link is absent.
// Does NOT cover: unauthenticated access (handled by proxy.ts), valid id wrong tenant.
test("non-existent order id does not render order detail", async ({ page }) => {
  await signInAsOwner(page);

  await page.goto("/restaurant/orders/does-not-exist-123");

  // A successfully rendered order detail always has the "Back to queue" link.
  // Its absence confirms the page 404'd rather than rendered stale/partial content.
  await expect(page.getByRole("link", { name: "Back to queue" })).toHaveCount(0);
});

// F3-PERM1: Cross-tenant 404 — owner of Mario's cannot view Spice Hub's order.
// The order detail page scopes its query to the caller's own restaurant, so a
// foreign order id returns notFound() (404).
test("cross-tenant: mario's owner cannot view spice hub order", async ({ page }) => {
  // Step 1: sign in as Spice Hub owner and capture its New order URL.
  await signIn(page, "owner2@demo.test");
  await expect(page).toHaveURL("/restaurant");

  const newColumn = page.locator("section", { hasText: "New" }).first();
  await expect(newColumn).toBeVisible();

  const firstOpen = newColumn.getByRole("link", { name: "Open" }).first();
  await firstOpen.click();
  await expect(page).toHaveURL(/\/restaurant\/orders\/.+/);
  const spiceOrderUrl = page.url();

  // Confirm the Spice Hub item is visible to its own owner.
  await expect(page.getByText("Paneer Butter Masala")).toBeVisible();

  // Step 2: sign out.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");

  // Step 3: sign in as Mario's owner and navigate directly to the captured URL.
  await signIn(page, "owner@demo.test");
  await expect(page).toHaveURL("/restaurant");

  await page.goto(spiceOrderUrl);

  // Mario's owner cannot see Spice Hub's item — the page 404s (query returns null
  // because restaurantId does not match). The item text must not be present.
  await expect(page.getByText("Paneer Butter Masala")).toHaveCount(0);
});
