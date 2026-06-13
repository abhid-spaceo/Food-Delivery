// app/(customer)/_lib/format.ts
// Money is integer cents everywhere (CLAUDE.md). This is the ONLY place the
// customer area turns cents into a $ string. (Mirrors (restaurant)/_lib/format.ts;
// consolidating the copies into lib/money.ts is a deferred Phase 6 cleanup.)
import type { OrderStatus } from "@/lib/generated/prisma/enums";

/** 1300 -> "$13.00". Pure formatting; never used for arithmetic. */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Human label for a status, e.g. OUT_FOR_DELIVERY -> "Out for delivery". */
export function statusLabel(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    PLACED: "Placed",
    ACCEPTED: "Accepted",
    PREPARING: "Preparing",
    READY: "Ready",
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Delivered",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  return map[status];
}

/** Short order reference from a cuid, e.g. "#a1b2c3". */
export function orderRef(id: string): string {
  return `#${id.slice(-6)}`;
}
