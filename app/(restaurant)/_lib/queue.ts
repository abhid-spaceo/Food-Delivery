// Shared query + types for the restaurant orders queue. Used by the server page
// (initial render) and the JSON route handler that SWR polls. Keeping the query
// in one place guarantees both paths apply the SAME payment gate and ownership
// scope (a PAID order for THIS restaurant only).
import { prisma } from "@/lib/db";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

export type QueueOrder = {
  id: string;
  status: OrderStatus;
  totalCents: number;
  itemCount: number;
  createdAt: string;
};

export type QueueData = {
  new: QueueOrder[];
  inProgress: QueueOrder[];
  completed: QueueOrder[];
};

const NEW_STATES: OrderStatus[] = ["PLACED"];
const IN_PROGRESS_STATES: OrderStatus[] = ["ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY"];
const COMPLETED_STATES: OrderStatus[] = ["DELIVERED", "REJECTED", "CANCELLED"];

/**
 * Load this restaurant's PAID orders, grouped New / In-progress / Completed.
 * PAYMENT GATES THE QUEUE: only orders whose Payment.status = PAID appear — an
 * unpaid PLACED order must never surface here (CLAUDE.md business rule).
 */
export async function getQueue(restaurantId: string): Promise<QueueData> {
  const orders = await prisma.order.findMany({
    where: { restaurantId, payment: { status: "PAID" } },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { quantity: true } } },
  });

  const mapped: QueueOrder[] = orders.map((o) => ({
    id: o.id,
    status: o.status,
    totalCents: o.totalCents,
    itemCount: o.items.reduce((sum, it) => sum + it.quantity, 0),
    createdAt: o.createdAt.toISOString(),
  }));

  return {
    new: mapped.filter((o) => NEW_STATES.includes(o.status)),
    inProgress: mapped.filter((o) => IN_PROGRESS_STATES.includes(o.status)),
    completed: mapped.filter((o) => COMPLETED_STATES.includes(o.status)),
  };
}
