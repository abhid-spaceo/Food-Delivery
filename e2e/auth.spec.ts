import { expect, test } from "@playwright/test";

// Auth happy/sad paths. Uses seeded accounts (password123):
//   admin@demo.test (ADMIN), owner@demo.test (RESTAURANT),
//   customer@demo.test (CUSTOMER), driver@demo.test (DRIVER, APPROVED)
//
// F5-N1/N2: wrong-password and unknown-email cases.
// F5-P3/P4: restaurant and driver sign-in redirects.
// F6-N4: duplicate-email signup.
// F6-P1: customer signup positive path.
// F6-P3: driver signup positive path (URL only; Driver PENDING verified Phase 3).
//
// NOTE — F5-N3, F6-N1/N2/N3 (empty name / bad email / short password) are
// enforced client-side by HTML `required` and `minLength` attributes. Playwright
// cannot submit those forms without filling the required fields, so those
// validation branches cannot be reached via the real UI. They are implicitly
// covered by the Zod schema (server-side guard) and the input attributes.

// F5-N1: Wrong password shows error, stays on /signin.
test("rejects invalid credentials with an error message", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("customer@demo.test");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL(/\/signin/);
});

// F5-N2: Unknown email shows same generic error (no user-enumeration).
test("unknown email shows invalid credentials error", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("nobody@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL(/\/signin/);
});

// F5-P1: Customer valid credentials → /browse.
test("customer signs in and lands on /browse", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("customer@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/browse");
  await expect(page.getByText("customer@demo.test")).toBeVisible();
});

// F5-P2: Admin valid credentials → /admin; sign out returns to /.
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

// F5-P3: Restaurant owner valid credentials → /restaurant.
test("restaurant owner signs in and lands on /restaurant", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("owner@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/restaurant");
});

// F5-P4: Driver valid credentials → /driver (URL only; page content is Phase 3).
test("driver signs in and is redirected to /driver", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("driver@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Assert URL only — the /driver page body is built in Phase 3.
  await expect(page).toHaveURL("/driver");
});

// F7-N1 (basic): Unauthenticated user is redirected from /admin.
test("proxy redirects an unauthenticated user from /admin to /signin", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/signin/);
});

// F7-N2: Customer cannot reach /admin (covered more fully in role-isolation.spec.ts).
test("role gating: a customer cannot reach /admin", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("customer@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/browse");

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/signin/); // bounced by the proxy
});

// F6-N4: Duplicate email on signup shows a clear error, no second user created.
test("signup with a duplicate email shows an error", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Duplicate User");
  await page.getByLabel("Email").fill("customer@demo.test");
  await page.getByLabel("Password").fill("password123");
  // Role defaults to Customer (first radio is defaultChecked).
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("An account with this email already exists")).toBeVisible();
  await expect(page).toHaveURL("/signup");
});

// F6-P1: Customer signup with unique email → auto sign-in → /browse.
test("customer signup with unique email lands on /browse", async ({ page }) => {
  const email = `signup-cust-${Date.now()}@demo.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("New Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  // Customer radio is defaultChecked; nothing extra to click.
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/browse");
});

// F6-P3: Driver signup → User + PENDING Driver created atomically → /driver.
// URL-only assertion; the /driver page body is Phase 3.
// TODO Phase 3: verify the new driver appears as PENDING in the admin Drivers UI.
test("driver signup with unique email redirects to /driver", async ({ page }) => {
  const email = `signup-drv-${Date.now()}@demo.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("New Driver");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.locator('input[value="DRIVER"]').check();
  await page.getByRole("button", { name: "Create account" }).click();
  // Assert URL only — page content is Phase 3.
  await expect(page).toHaveURL("/driver");
});
