// app/(driver)/_lib/deliveries.ts
// Driver-scoped delivery queries + earnings. Earnings = sum of deliveryFeeCents
// over this driver's DELIVERED orders (display only, no payouts). Integer cents.
import { prisma } from "@/lib/db";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

interface FeeBearingOrder {
  status: OrderStatus;
  deliveryFeeCents: number;
}

/** Pure: total earned fees = Σ deliveryFeeCents where status === DELIVERED. */
export function sumDeliveredFees(orders: readonly FeeBearingOrder[]): number {
  return orders
    .filter((o) => o.status === "DELIVERED")
    .reduce((sum, o) => sum + o.deliveryFeeCents, 0);
}

/** Earnings tally for a driver (DELIVERED only), via a DB aggregate. */
export async function getEarnings(driverId: string): Promise<number> {
  const agg = await prisma.order.aggregate({
    _sum: { deliveryFeeCents: true },
    where: { driverId, status: "DELIVERED" },
  });
  return agg._sum.deliveryFeeCents ?? 0;
}

/** This driver's deliveries split into active (OUT_FOR_DELIVERY) and past (DELIVERED). */
export async function getMyDeliveries(driverId: string) {
  const orders = await prisma.order.findMany({
    where: { driverId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      totalCents: true,
      deliveryFeeCents: true,
      addressLine: true,
      restaurant: { select: { name: true } },
    },
  });
  return {
    active: orders.filter((o) => o.status === "OUT_FOR_DELIVERY"),
    past: orders.filter((o) => o.status === "DELIVERED"),
  };
}

// --- Pickup pool ---

export type PoolOrder = {
  id: string;
  restaurantName: string;
  itemCount: number;
  totalCents: number;
  deliveryFeeCents: number;
  createdAt: string;
};

/** The shared pickup pool: PAID, unclaimed, READY orders. Visible to every
 *  APPROVED driver; the first to claim wins (atomic claim in the action). */
export async function getPool(): Promise<PoolOrder[]> {
  const orders = await prisma.order.findMany({
    where: { status: "READY", driverId: null, payment: { status: "PAID" } },
    orderBy: { createdAt: "asc" }, // oldest first (fairer pickup order)
    select: {
      id: true,
      totalCents: true,
      deliveryFeeCents: true,
      createdAt: true,
      restaurant: { select: { name: true } },
      items: { select: { quantity: true } },
    },
  });
  return orders.map((o) => ({
    id: o.id,
    restaurantName: o.restaurant.name,
    itemCount: o.items.reduce((sum, it) => sum + it.quantity, 0),
    totalCents: o.totalCents,
    deliveryFeeCents: o.deliveryFeeCents,
    createdAt: o.createdAt.toISOString(),
  }));
}
