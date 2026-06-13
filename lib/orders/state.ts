// Order state machine — the single source of truth for legal order transitions.
// Every status change (in Server Actions) MUST go through assertTransition so an
// illegal jump like PLACED -> DELIVERED is impossible. See CLAUDE.md.
import type { OrderStatus } from "@/lib/generated/prisma/enums";

// Allowed next states for each status. A `Record<OrderStatus, ...>` means TS
// forces this map to stay exhaustive if the schema's OrderStatus ever changes.
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["ACCEPTED", "REJECTED", "CANCELLED"], // restaurant accepts/rejects; customer/admin cancels (only here)
  ACCEPTED: ["PREPARING"],
  PREPARING: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],
  REJECTED: [],
  CANCELLED: [],
};

/** Statuses reachable from `from` in one legal step. */
export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

/** True if `from -> to` is a legal one-step transition. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** True if the order can no longer change state (delivered/rejected/cancelled). */
export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Illegal order transition: ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
  }
}

/** Throws IllegalTransitionError if `from -> to` is not allowed. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
}
