// Pure helper: extract orderId from a Stripe checkout.session.completed event.
// Keeping this logic separate lets it be unit-tested without network/Stripe keys.
import type Stripe from "stripe";

/**
 * Returns the orderId stored in event.data.object.metadata, or null when:
 * - the event type is not "checkout.session.completed"
 * - metadata is absent / does not contain orderId
 */
export function orderIdFromCheckoutSession(event: Stripe.Event): string | null {
  if (event.type !== "checkout.session.completed") return null;
  const session = event.data.object as Stripe.Checkout.Session;
  return session.metadata?.orderId ?? null;
}
