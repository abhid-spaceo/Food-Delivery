import { defineConfig, devices } from "@playwright/test";

// E2E config. Reuses an already-running dev server if present, otherwise starts
// one. Tests rely on the deterministic seed (pnpm db:seed).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // One shared Postgres DB backs every spec, so specs must run serially —
  // otherwise specs that drive the same queue (customer + restaurant) race and
  // steal each other's orders. fullyParallel:false alone still allows multiple
  // workers across files; workers:1 forces a single serial worker.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
