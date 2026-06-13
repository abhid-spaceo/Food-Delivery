// Stripe webhook Route Handler. POST /api/stripe/webhook.
// Verifies the Stripe signature, then on checkout.session.completed marks the
// order paid so it appears in the restaurant queue.
// Rules: Route Handlers are the exception (only for webhook / SWR polling).
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getStripe } from "@/lib/stripe";
import { markOrderPaid } from "@/lib/orders/payment";
import { orderIdFromCheckoutSession } from "@/lib/orders/stripe-events";

// Next.js must not buffer the body — Stripe needs the raw bytes for HMAC.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not configured" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const orderId = orderIdFromCheckoutSession(event);
  if (orderId) {
    await markOrderPaid(orderId);
    revalidatePath("/restaurant");
    revalidatePath(`/orders/${orderId}`);
  }

  return NextResponse.json({ received: true });
}
