import { expect, test } from "@playwright/test";

// F7 — Route guards / role isolation.
// Verifies that the proxy redirects unauthenticated users and wrong-role users
// away from protected routes, and that public routes are always reachable.
//
// Seeded accounts (password123):
//   admin@demo.test (ADMIN), owner@demo.test (RESTAURANT),
//   customer@demo.test (CUSTOMER), driver@demo.test (DRIVER, APPROVED)
//
// NOT covered: ownership/tenant scoping (F3-PERM1) — that is layer 2 and lives
// in restaurant-fulfillment.spec.ts. Driver page content is Phase 3 — only the
// URL (guard pass) is asserted here.

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
}

// F7-N1: Unauthenticated users are redirected to /signin for every protected route.
test("unauthenticated: protected routes redirect to /signin", async ({ page }) => {
  const protectedPaths = [
    "/admin",
    "/restaurant",
    "/driver",
    "/orders",
    "/checkout",
    "/cart",
    "/account",
  ];

  for (const path of protectedPaths) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin/, { message: `${path} should redirect to /signin` });
  }
});

// F7-E1: Public routes are reachable by unauthenticated users (no guard, no redirect).
test("unauthenticated: public routes are accessible without redirect", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");

  await page.goto("/browse");
  await expect(page).toHaveURL("/browse");

  // /signin and /signup are themselves public — just confirm no infinite redirect.
  await page.goto("/signin");
  await expect(page).toHaveURL("/signin");

  await page.goto("/signup");
  await expect(page).toHaveURL("/signup");
});

// F7-N2 + F7-N3: Customer cannot reach /admin, /restaurant, or /driver.
test("customer: cannot reach /admin, /restaurant, or /driver", async ({ page }) => {
  await signIn(page, "customer@demo.test");
  await expect(page).toHaveURL("/browse");

  for (const path of ["/admin", "/restaurant", "/driver"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin/, { message: `customer should be bounced from ${path}` });
  }
});

// F7-N4: Restaurant owner cannot reach /admin or /driver.
test("restaurant: cannot reach /admin or /driver", async ({ page }) => {
  await signIn(page, "owner@demo.test");
  await expect(page).toHaveURL("/restaurant");

  for (const path of ["/admin", "/driver"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin/, { message: `restaurant should be bounced from ${path}` });
  }
});

// F7-N5 + F7-P1 (partial) + F7-E2: Driver cannot reach /admin or /restaurant.
// The driver URL is asserted (guard allows role), but page content is Phase 3.
test("driver: cannot reach /admin or /restaurant; /driver guard passes", async ({ page }) => {
  await signIn(page, "driver@demo.test");
  // After sign-in the proxy redirects to /driver (guard allows the DRIVER role).
  // The page itself may be a 404 body until Phase 3 — assert URL only.
  await expect(page).toHaveURL("/driver");

  for (const path of ["/admin", "/restaurant"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/signin/, { message: `driver should be bounced from ${path}` });
  }
});
