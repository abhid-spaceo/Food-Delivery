import { expect, test } from "@playwright/test";

// Driver module (Phase 3): admin approves drivers; an approved driver claims a
// READY order atomically, delivers it, and sees earnings. Negatives: a second
// driver claiming a taken order gets "not available"; a PENDING driver can't reach
// the pool.
//
// Seeded (password123): driver@demo.test + driver2@demo.test (both APPROVED),
// owner@demo.test (Mario's), admin@demo.test, and TWO PAID unclaimed READY orders.
// The happy-path test and the already-claimed test each consume one READY order,
// so both can run in the same suite pass without contending.
// PRECONDITION: pnpm prisma migrate dev && pnpm db:seed.
//
// NOT covered: real concurrency (the race is tested deterministically by claiming
// then re-claiming the same order), online/offline toggle (Phase 5), the full
// customer->driver loop (needs Phase 2 merged).
//
// Route note: the pickup-pool JSON is served at /driver/pool/api (Route Handler);
// the pool PAGE is /driver/pool. Tests navigate to the page and click "View & claim".

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Wait for the post-login redirect so the session is established before any
  // subsequent navigation to a guarded route (otherwise it races to /signin).
  await page.waitForURL((url) => !url.pathname.includes("/signin"));
}

// Helper: open one READY order card from the pool and return its URL.
// Uses .first() so each consuming test reliably picks a card even when 2 remain.
async function openPoolOrder(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/driver/pool");
  await page.getByRole("link", { name: "View & claim" }).first().click();
  await expect(page).toHaveURL(/\/driver\/order\/.+/);
  return page.url();
}

// Happy path: claim -> deliver -> earnings.
test("approved driver claims a READY order, delivers it, and earns the fee", async ({ page }) => {
  await signIn(page, "driver@demo.test");
  await expect(page).toHaveURL("/driver/pool");

  await openPoolOrder(page);
  await expect(page.getByRole("button", { name: "Claim this order" })).toBeVisible();
  await page.getByRole("button", { name: "Claim this order" }).click();

  // Lands on My deliveries; the order is now active (out for delivery).
  await expect(page).toHaveURL("/driver/deliveries");
  // Force a fresh server render so we don't read a stale client-router cache.
  await page.reload();
  await expect(page.getByText("OUT_FOR_DELIVERY").first()).toBeVisible();

  // Open the active delivery and mark it delivered.
  await page.getByRole("link").filter({ hasText: /Mario|Brigade/ }).first().click();
  await expect(page).toHaveURL(/\/driver\/order\/.+/);
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(page.getByText("DELIVERED")).toBeVisible();

  // Earnings reflect the $2.99 delivery fee.
  await page.goto("/driver/earnings");
  await expect(page.getByText("$2.99")).toBeVisible();
});

// Negative: a second driver cannot claim an order the first already took.
test("second driver cannot claim an already-claimed order", async ({ page }) => {
  // Driver 1 claims one READY order from the pool — captures the exact URL.
  await signIn(page, "driver@demo.test");
  const orderUrl = await openPoolOrder(page);
  await page.getByRole("button", { name: "Claim this order" }).click();
  await expect(page).toHaveURL("/driver/deliveries");

  // Driver 2 navigates straight to that specific order — it is no longer claimable.
  await signIn(page, "driver2@demo.test");
  await page.goto(orderUrl);
  await expect(page.getByText("This order isn't available to you.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim this order" })).toHaveCount(0);
});

// Negative: a PENDING driver cannot reach the pool (bounced to the awaiting screen).
test("a pending driver is kept out of the pool", async ({ page }) => {
  // Create a fresh driver via signup (role Driver) -> PENDING.
  const email = `pending+${Date.now()}@demo.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Pat Pending");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("radio", { name: "Driver" }).check();
  await page.getByRole("button", { name: "Create account" }).click();

  // Signup lands on /driver; a PENDING driver sees the awaiting-approval screen.
  await expect(page).toHaveURL(/\/driver/);
  await expect(page.getByText(/awaiting admin approval/i)).toBeVisible();

  // Direct navigation to the pool bounces back to /driver.
  await page.goto("/driver/pool");
  await expect(page).toHaveURL("/driver");
});

// Admin approves a PENDING driver -> they gain pool access.
test("admin approves a pending driver", async ({ page }) => {
  const email = `approve+${Date.now()}@demo.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada Approve");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("radio", { name: "Driver" }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/driver/);

  // Admin approves them.
  await signIn(page, "admin@demo.test");
  await page.goto("/admin/drivers?status=PENDING");
  const row = page.locator("tr", { hasText: email });
  await row.getByRole("button", { name: "Approve" }).click();
  // Once approved, the driver leaves the PENDING-filtered list...
  await expect(page.locator("tr", { hasText: email })).toHaveCount(0);
  // ...and now appears under the Approved filter.
  await page.goto("/admin/drivers?status=APPROVED");
  await expect(page.locator("tr", { hasText: email }).getByText("APPROVED")).toBeVisible();
});
