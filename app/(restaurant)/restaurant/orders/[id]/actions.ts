"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant } from "@/app/(restaurant)/_lib/restaurant";
import { assertTransition } from "@/lib/orders/state";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

// Advance one order to `to`. SECOND authz layer + state machine in one place:
//   1. resolve the caller's OWN restaurant (requireOwnedRestaurant)
//   2. load the order and confirm it belongs to that restaurant
//   3. assertTransition(from, to, "RESTAURANT") — illegal jumps AND actor
//      violations (a restaurant attempting the driver-only delivery leg) throw
//   4. update status AND append an OrderStatusEvent (byUserId) in one tx
// The restaurant drives an order only as far as READY; a driver then claims it.
async function advanceOrder(orderId: string, to: OrderStatus, extra?: { prepMinutes?: number }) {
  const { restaurant, userId } = await requireOwnedRestaurant();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, restaurantId: true },
  });
  if (!order || order.restaurantId !== restaurant.id) {
    throw new Error("Order not found");
  }

  const from = order.status;
  assertTransition(from, to, "RESTAURANT");

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: to,
        ...(extra?.prepMinutes != null ? { prepMinutes: extra.prepMinutes } : {}),
      },
    }),
    prisma.orderStatusEvent.create({
      data: { orderId: order.id, from, to, byUserId: userId },
    }),
  ]);

  revalidatePath(`/restaurant/orders/${order.id}`);
  revalidatePath("/restaurant");
}

// acceptOrder receives a formData from the form (orderId is pre-bound as the
// first arg; the form action is action.bind(null, orderId)).
export async function acceptOrder(orderId: string, formData: FormData) {
  const raw = formData.get("prepMinutes");
  const prepMinutes = raw
    ? z.coerce.number().int().min(1).max(120).optional().parse(raw) ?? undefined
    : undefined;
  await advanceOrder(orderId, "ACCEPTED", { prepMinutes });
}

export async function rejectOrder(orderId: string, _formData: FormData) {
  await advanceOrder(orderId, "REJECTED");
}

export async function startPreparing(orderId: string, _formData: FormData) {
  await advanceOrder(orderId, "PREPARING");
}

export async function markReady(orderId: string, _formData: FormData) {
  await advanceOrder(orderId, "READY");
}
