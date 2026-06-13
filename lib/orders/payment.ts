// Stub payment seam. markOrderPaid flips Payment PENDING -> PAID. This is the
// SINGLE place payment becomes PAID; Phase 4 will call the SAME function from the
// Stripe webhook, so order creation never changes. Idempotent: the predicate
// matches only PENDING, so a replay/double-click changes 0 rows.
import { prisma } from "@/lib/db";

/** Mark an order paid. Returns true if THIS call flipped it (false if already paid/absent). */
export async function markOrderPaid(orderId: string): Promise<boolean> {
  const result = await prisma.payment.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: "PAID" },
  });
  return result.count > 0;
}
