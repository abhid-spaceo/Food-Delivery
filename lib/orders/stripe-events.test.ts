import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { orderIdFromCheckoutSession } from "./stripe-events";

// Minimal Stripe.Event stub — we only need the fields the helper touches.
function makeEvent(
  type: string,
  metadata?: Record<string, string> | null,
): Stripe.Event {
  return {
    type,
    data: {
      object: {
        object: "checkout.session",
        metadata: metadata ?? null,
      } as Stripe.Checkout.Session,
    },
  } as unknown as Stripe.Event;
}

describe("orderIdFromCheckoutSession", () => {
  it("returns the orderId from a completed session with metadata", () => {
    const event = makeEvent("checkout.session.completed", { orderId: "order_abc123" });
    expect(orderIdFromCheckoutSession(event)).toBe("order_abc123");
  });

  it("returns null for a completed session without orderId in metadata", () => {
    const event = makeEvent("checkout.session.completed", {});
    expect(orderIdFromCheckoutSession(event)).toBeNull();
  });

  it("returns null for a non-completed event type", () => {
    const event = makeEvent("payment_intent.succeeded", { orderId: "order_abc123" });
    expect(orderIdFromCheckoutSession(event)).toBeNull();
  });
});
