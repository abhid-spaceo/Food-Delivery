"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireApprovedDriver } from "@/app/(driver)/_lib/driver";
import { assertTransition } from "@/lib/orders/state";
import { assertClaimed } from "@/lib/orders/claim";

// Claim a READY order from the pool. FIRST-COME + ATOMIC: a single conditional
// updateMany (status=READY AND driverId=null) flips it to OUT_FOR_DELIVERY and
// stamps this driver. If it changes 0 rows, someone else already claimed it ->
// AlreadyClaimedError, and NO event is written. The whole thing runs in one
// transaction so the status flip and its audit event commit together.
export async function claimOrder(orderId: string): Promise<void> {
  const { driver, userId } = await requireApprovedDriver();

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "READY", driverId: null },
      data: { status: "OUT_FOR_DELIVERY", driverId: driver.id },
    });
    assertClaimed(count); // throws AlreadyClaimedError on 0 rows -> rolls back

    await tx.orderStatusEvent.create({
      data: { orderId, from: "READY", to: "OUT_FOR_DELIVERY", byUserId: userId },
    });
  });

  revalidatePath("/driver/pool");
  revalidatePath(`/driver/order/${orderId}`);
  revalidatePath("/driver/deliveries");
}

// Mark a claimed order delivered. Ownership: the order must be OUT_FOR_DELIVERY
// AND already claimed by THIS driver (a foreign/unclaimed id matches nothing).
export async function markDelivered(orderId: string): Promise<void> {
  const { driver, userId } = await requireApprovedDriver();

  const order = await prisma.order.findFirst({
    where: { id: orderId, driverId: driver.id },
    select: { id: true, status: true },
  });
  if (!order) throw new Error("Order not found");

  assertTransition(order.status, "DELIVERED", "DRIVER"); // throws unless OUT_FOR_DELIVERY

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } }),
    prisma.orderStatusEvent.create({
      data: { orderId: order.id, from: order.status, to: "DELIVERED", byUserId: userId },
    }),
  ]);

  revalidatePath(`/driver/order/${order.id}`);
  revalidatePath("/driver/deliveries");
  revalidatePath("/driver/earnings");
}
