"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCustomerId } from "@/app/(customer)/_lib/customer";
import { markOrderPaid } from "@/lib/orders/payment";
import { assertTransition } from "@/lib/orders/state";

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
