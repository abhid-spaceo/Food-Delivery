// Order state machine — the single source of truth for legal order transitions
// AND which actor may fire each one. Every status change (in Server Actions)
// MUST go through assertTransition so an illegal jump (PLACED -> DELIVERED) or a
// wrong actor (a restaurant marking DELIVERED) is impossible. See CLAUDE.md.
import type { OrderStatus } from "@/lib/generated/prisma/enums";

// Who may fire a transition. A string-literal union (not the Prisma Role enum)
// keeps the state machine dependency-free; ADMIN is an override on every edge.
export type Actor = "CUSTOMER" | "RESTAURANT" | "DRIVER" | "ADMIN";

// Allowed next states for each status. A `Record<OrderStatus, ...>` means TS
// forces this map to stay exhaustive if the schema's OrderStatus ever changes.
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["PREPARING"],
  PREPARING: ["READY"], // restaurant cooks, then marks ready for pickup
  READY: ["OUT_FOR_DELIVERY"], // a driver claims it from the pool
  OUT_FOR_DELIVERY: ["DELIVERED"], // the claiming driver delivers it
  DELIVERED: [],
  REJECTED: [],
  CANCELLED: [],
};

// Allowed actors per legal edge, keyed "FROM->TO". The restaurant drives the
// kitchen legs through READY; the claiming driver owns the delivery legs; the
// customer may only cancel before acceptance; ADMIN is allowed everywhere.
const TRANSITION_ACTORS: Record<string, readonly Actor[]> = {
  "PLACED->ACCEPTED": ["RESTAURANT", "ADMIN"],
  "PLACED->REJECTED": ["RESTAURANT", "ADMIN"],
  "PLACED->CANCELLED": ["CUSTOMER", "ADMIN"],
  "ACCEPTED->PREPARING": ["RESTAURANT", "ADMIN"],
  "PREPARING->READY": ["RESTAURANT", "ADMIN"],
  "READY->OUT_FOR_DELIVERY": ["DRIVER", "ADMIN"],
  "OUT_FOR_DELIVERY->DELIVERED": ["DRIVER", "ADMIN"],
};

/** Statuses reachable from `from` in one legal step. */
export function nextStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

/** True if `from -> to` is a legal one-step transition (ignores actor). */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** True if the order can no longer change state (delivered/rejected/cancelled). */
export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** True if `actor` may fire the (legal) edge `from -> to`. */
export function canActorTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: Actor,
): boolean {
  if (!canTransition(from, to)) return false;
  return (TRANSITION_ACTORS[`${from}->${to}`] ?? []).includes(actor);
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

export class UnauthorizedActorError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
    public readonly actor: Actor,
  ) {
    super(`Actor ${actor} may not perform transition ${from} -> ${to}`);
    this.name = "UnauthorizedActorError";
  }
}

/**
 * Validate a transition. Graph legality is ALWAYS checked (throws
 * IllegalTransitionError). If `actor` is provided, it must also be allowed to
 * fire this edge (throws UnauthorizedActorError). Omitting `actor` keeps the
 * original graph-only behavior, so existing call sites stay valid.
 */
export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor?: Actor,
): void {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
  if (actor && !canActorTransition(from, to, actor)) {
    throw new UnauthorizedActorError(from, to, actor);
  }
}
