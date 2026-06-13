"use server";

import { revalidatePath } from "next/cache";
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
async function advanceOrder(orderId: string, to: OrderStatus) {
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
    prisma.order.update({ where: { id: order.id }, data: { status: to } }),
    prisma.orderStatusEvent.create({
      data: { orderId: order.id, from, to, byUserId: userId },
    }),
  ]);

  revalidatePath(`/restaurant/orders/${order.id}`);
  revalidatePath("/restaurant");
}

export async function acceptOrder(orderId: string) {
  await advanceOrder(orderId, "ACCEPTED");
}

export async function rejectOrder(orderId: string) {
  await advanceOrder(orderId, "REJECTED");
}

export async function startPreparing(orderId: string) {
  await advanceOrder(orderId, "PREPARING");
}

export async function markReady(orderId: string) {
  await advanceOrder(orderId, "READY");
}
