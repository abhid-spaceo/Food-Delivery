import { expect, test } from "@playwright/test";

// Admin panel tests. Uses the seeded admin account (admin@demo.test / password123).
//
// Seed guarantees: Mario's Pizza APPROVED, at least 3 Mario's PAID PLACED orders,
// one unclaimed READY order (Pepperoni ×1, $13.99 + $2.99 = $16.98 total).
//
// PRECONDITION: run `pnpm prisma migrate dev` and `pnpm db:seed` first.
//
// NOTE on approve/suspend test: the seed has Mario's Pizza already APPROVED, so
// that test first SUSPENDs it to create a non-approved row, then approves it back.
//
// NOT covered: Users screen, payment/revenue math, driver approval, pagination.

async function signInAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("admin@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/admin");
}

test("admin can suspend then approve a restaurant", async ({ page }) => {
  await signInAsAdmin(page);

  // Open the Restaurants screen via the sidebar.
  await page.getByRole("link", { name: "Restaurants" }).click();
  await expect(page).toHaveURL("/admin/restaurants");

  // Scope to the seeded "Mario's Pizza" row.
  const row = page.getByRole("row", { name: /Mario's Pizza/ });
  await expect(row).toBeVisible();

  // Suspend it -> SUSPENDED, so we have a clean non-approved starting point.
  await row.getByRole("button", { name: "Suspend" }).click();
  await expect(row.getByText("SUSPENDED")).toBeVisible();

  // Approve it -> APPROVED. This is the core admin action under test.
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.getByText("APPROVED")).toBeVisible();
});

// F8-P2 — overview KPI cards render with the expected labels.
// The admin overview page (/admin) renders a <StatCard> for each metric. We
// assert the two most stable labels. The numeric values are not asserted here
// because they vary with the DB state.
// Does NOT cover: value accuracy, revenue math, recent-orders table.
test("admin overview shows platform KPI cards", async ({ page }) => {
  await signInAsAdmin(page);
  // Already on /admin after sign-in.

  // The overview page renders StatCard components with these exact labels
  // (from app/(admin)/admin/page.tsx). "Total orders" and "Pending approvals"
  // are unique to the KPI grid — no sidebar link or table header shares them.
  await expect(page.getByText("Total orders")).toBeVisible();
  await expect(page.getByText("Pending approvals")).toBeVisible();
});

// F8-P3 — orders filter by READY. Clicking the "Ready" filter link navigates
// to ?status=READY and the table contains the seeded unclaimed READY order,
// which the Badge component renders as the text "READY".
// Does NOT cover: other filter values, pagination, detail panel.
test("admin orders page filters to READY status", async ({ page }) => {
  await signInAsAdmin(page);

  // Navigate to the Orders section via the sidebar link.
  await page.getByRole("link", { name: "Orders" }).click();
  await expect(page).toHaveURL("/admin/orders");

  // The FilterBar renders each option as a <Link>. Click the "Ready" link
  // (label from FILTER_OPTIONS in app/(admin)/admin/orders/page.tsx).
  await page.getByRole("link", { name: "Ready" }).click();

  // URL must now carry the filter param.
  await expect(page).toHaveURL(/status=READY/);

  // The seeded unclaimed READY (Pepperoni) order exists; the Badge renders
  // the raw status string "READY" as the pill text.
  await expect(page.getByText("READY").first()).toBeVisible();
});

// F8-N1 — bogus ?status= value falls back gracefully. parseStatus() returns
// undefined for unknown values, so the query returns all orders and the page
// renders normally (no crash, "Orders" heading present, table has rows).
// Does NOT cover: server error states, empty-database edge case.
test("admin orders page handles bogus status filter without crashing", async ({ page }) => {
  await signInAsAdmin(page);

  // Navigate directly with an invalid status query param.
  await page.goto("/admin/orders?status=NONSENSE");

  // The page must not crash — the Orders heading must be visible.
  await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

  // At least one order row must exist (seeded data always has orders).
  // The table renders a <TR> per order; we use a loose locator for any row.
  await expect(page.locator("table tbody tr").first()).toBeVisible();
});
