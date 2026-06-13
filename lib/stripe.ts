// Stripe client (TEST MODE ONLY). Lazily constructed so the app boots before
// keys are configured — checkout (Slice 3) calls getStripe() at request time.
import Stripe from "stripe";

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured (test mode key required)");
  }
  return new Stripe(key);
}
