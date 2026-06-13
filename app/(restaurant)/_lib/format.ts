// Display helpers for the restaurant area. Money is integer cents everywhere
// (see CLAUDE.md) — this is the ONLY place we turn cents into a $ string.
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
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Delivered",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  return map[status];
}

/** Label for the button that performs a transition TO this status. */
export function actionLabel(to: OrderStatus): string {
  const map: Partial<Record<OrderStatus, string>> = {
    ACCEPTED: "Accept",
    REJECTED: "Reject",
    PREPARING: "Start preparing",
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Mark delivered",
  };
  return map[to] ?? statusLabel(to);
}

/** Short order reference from a cuid, e.g. "#a1b2c3". */
export function orderRef(id: string): string {
  return `#${id.slice(-6)}`;
}
