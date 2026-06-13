import { describe, expect, it } from "vitest";
import { FLAT_DELIVERY_FEE_CENTS } from "./fees";

describe("delivery fee", () => {
  it("is a positive integer number of cents (no floats)", () => {
    expect(Number.isInteger(FLAT_DELIVERY_FEE_CENTS)).toBe(true);
    expect(FLAT_DELIVERY_FEE_CENTS).toBeGreaterThan(0);
  });

  it("matches the seed fixtures' fee ($2.99)", () => {
    expect(FLAT_DELIVERY_FEE_CENTS).toBe(299);
  });
});
