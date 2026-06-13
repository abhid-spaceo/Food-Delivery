// app/(driver)/_lib/deliveries.test.ts
import { describe, expect, it } from "vitest";
import { sumDeliveredFees } from "./deliveries";

describe("driver earnings math", () => {
  it("sums deliveryFeeCents over DELIVERED orders only", () => {
    const orders = [
      { status: "DELIVERED", deliveryFeeCents: 299 },
      { status: "DELIVERED", deliveryFeeCents: 199 },
      { status: "OUT_FOR_DELIVERY", deliveryFeeCents: 500 }, // not yet earned
    ] as const;
    expect(sumDeliveredFees(orders)).toBe(299 + 199);
  });

  it("is zero for no delivered orders", () => {
    expect(sumDeliveredFees([])).toBe(0);
    expect(sumDeliveredFees([{ status: "OUT_FOR_DELIVERY", deliveryFeeCents: 500 }] as const)).toBe(0);
  });

  it("returns an integer number of cents", () => {
    const orders = [{ status: "DELIVERED", deliveryFeeCents: 299 }] as const;
    expect(Number.isInteger(sumDeliveredFees(orders))).toBe(true);
  });
});
