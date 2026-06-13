import { expect, test } from "@playwright/test";

// Admin approve-restaurant happy path. Uses the seeded admin account
// (admin@demo.test / password123). NOTE: do not run blind against a mutated DB —
// the seed has Mario's Pizza already APPROVED, so this test first SUSPENDS it to
// create a non-approved row, then approves it back, leaving state as found.
//
// Coverage: sign-in as admin, navigate to Restaurants, toggle status via the
// Server Actions, and verify the status badge updates.
// Does NOT cover: the Users/Orders/Overview screens, the ?status= filter links,
// role-isolation (covered in auth.spec.ts), or payment/revenue math.

test("admin can suspend then approve a restaurant", async ({ page }) => {
  // Sign in as the seeded admin and land on the dashboard.
  await page.goto("/signin");
  await page.getByLabel("Email").fill("admin@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/admin");

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
