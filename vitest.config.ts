import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    env: {
      // Placeholder so lib/db.ts passes its startup guard in unit tests.
      // Pure functions (sumDeliveredFees, assertClaimed) never actually connect.
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://test@localhost/test",
    },
  },
});
