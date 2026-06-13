"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCustomerId } from "@/app/(customer)/_lib/customer";
import { markOrderPaid } from "@/lib/orders/payment";
import { assertTransition } from "@/lib/orders/state";
import { getStripe } from "@/lib/stripe";

// Start a Stripe Checkout Session for this order. The customer is redirected to
// Stripe's hosted page; on success Stripe posts to our webhook which calls
// markOrderPaid. Returns the Stripe session URL.
export async function createCheckoutSession(orderId: string): Promise<string> {
  const customerId = await requireCustomerId();
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: {
      id: true,
      deliveryFeeCents: true,
      items: { select: { name: true, priceCents: true, quantity: true } },
      payment: { select: { status: true } },
    },
  });
  if (!order) throw new Error("Order not found");
  if ((order.payment?.status ?? "PENDING") !== "PENDING") {
    throw new Error("Order is already paid");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const stripe = getStripe();

  const lineItems = [
    // One line item per snapshotted OrderItem
    ...order.items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: { name: item.name },
        unit_amount: item.priceCents, // already in cents
      },
      quantity: item.quantity,
    })),
    // Delivery fee as a separate line item
    ...(order.deliveryFeeCents > 0
      ? [
          {
            price_data: {
              currency: "usd",
              product_data: { name: "Delivery fee" },
              unit_amount: order.deliveryFeeCents,
            },
            quantity: 1,
          },
        ]
      : []),
  ];

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    metadata: { orderId: order.id },
    success_url: `${appUrl}/orders/${order.id}?paid=1`,
    cancel_url: `${appUrl}/orders/${order.id}`,
  });

  // Persist the session id so the webhook can correlate later
  await prisma.payment.updateMany({
    where: { orderId: order.id, status: "PENDING" },
    data: { stripeSessionId: session.id },
  });

  if (!session.url) throw new Error("Stripe did not return a session URL");
  return session.url;
}

// DEV-ONLY stub: flip this order's payment to PAID. Ownership-scoped (the order
// must belong to the caller) AND disabled in production (Phase 4 replaces this
// with Stripe). Mirrors what the Stripe webhook will later do via markOrderPaid.
export async function devMarkPaid(orderId: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("dev mark-paid is disabled in production");
  }
  const customerId = await requireCustomerId();
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: { id: true },
  });
  if (!order) throw new Error("Order not found");

  await markOrderPaid(order.id);

  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/restaurant"); // the order now becomes visible in the queue
}

// Customer cancels their own order. Only legal while PLACED (state machine,
// actor CUSTOMER). Ownership-scoped; appends an event in one transaction.
export async function cancelOrder(orderId: string): Promise<void> {
  const customerId = await requireCustomerId();
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: { id: true, status: true },
  });
  if (!order) throw new Error("Order not found");

  assertTransition(order.status, "CANCELLED", "CUSTOMER"); // throws unless PLACED

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } }),
    prisma.orderStatusEvent.create({
      data: { orderId: order.id, from: order.status, to: "CANCELLED", byUserId: customerId },
    }),
  ]);

  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/orders");
}
