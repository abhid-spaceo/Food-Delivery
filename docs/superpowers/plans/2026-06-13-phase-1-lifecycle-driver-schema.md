# Phase 1 — Lifecycle & Schema Groundwork (READY + Driver model + actor authz) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing 3-role codebase 4-role-aware — add the `Driver` model + `READY` order state + an actor-aware state machine, and update the existing restaurant/admin/auth code that this breaks — without regressing any current flow.

**Architecture:** One Next.js 16 app, Prisma 7 (client generated to `lib/generated/prisma`), Auth.js v5 with JWT role sessions. The order state machine in `lib/orders/state.ts` is the single source of truth for transitions; this phase teaches it `READY` and *who* may fire each edge. Schema changes are purely additive (new enum values, new model, new nullable column). Build on branch `Abhi/qwikbite`.

**Tech Stack:** TypeScript · Next.js 16 · React 19 · Prisma 7 (pg adapter) · Auth.js v5 · Tailwind v4 · Vitest (unit) · Playwright (E2E) · pnpm.

**Verified against code 2026-06-13** — every "what breaks" claim below was confirmed by reading the actual files. Reference: `docs/superpowers/plans/2026-06-13-qwikbite-implementation-roadmap.md` (Phase 1).

**Preconditions:** On branch `Abhi/qwikbite`; local Postgres running with `DATABASE_URL` set in `.env`; `pnpm install` done; `pnpm test` / `pnpm build` currently green.

---

## File map (what changes and why)

| File | Change | Why |
|---|---|---|
| `prisma/schema.prisma` | Add `DRIVER` to `Role`, `READY` to `OrderStatus`, new `DriverStatus` enum, new `Driver` model, `Order.driverId` + relation + index, `User.driver` back-relation | The data foundation for the 4th role + the delivery handoff state |
| `prisma/migrations/*` | New additive migration | Apply the schema change to the DB |
| `lib/orders/state.ts` | Add `READY` edges + `Actor` model (`assertTransition(from,to,actor?)`, `canActorTransition`, `TRANSITION_ACTORS`, `UnauthorizedActorError`) | State machine must know `READY` and enforce *who* fires each edge |
| `lib/orders/state.test.ts` | Update legal/illegal tables, add actor tests | TDD — lock the new behavior |
| `app/(restaurant)/restaurant/orders/[id]/actions.ts` | Remove `outForDelivery`/`markDelivered`, add `markReady`, pass `"RESTAURANT"` actor | Restaurant drives only through `READY`; delivery leg is driver-only |
| `app/(restaurant)/_components/order-actions.tsx` | Update `ACTION_FOR` map + imports | Its import of the removed actions would break the build otherwise |
| `app/(restaurant)/_lib/format.ts` | Add `READY` to `statusLabel` + `actionLabel` | Exhaustive `Record<OrderStatus>` won't compile without it |
| `app/(restaurant)/_components/status-badge.tsx` | Add `READY` to `STYLES` | Same exhaustiveness |
| `app/(restaurant)/_lib/queue.ts` | Add a `ready` bucket to `QueueData` | Show "Ready · awaiting driver" distinctly |
| `app/(restaurant)/_components/queue-board.tsx` | Render a Ready column | Surface the new bucket |
| `app/(admin)/_components/badge.tsx` | Add `READY` + `DRIVER` tones | Avoid gray fallback |
| `app/(admin)/admin/orders/page.tsx` | Add `Ready` filter option | Admin can filter by the new state |
| `app/(auth)/actions.ts` | `ROLE_HOME += DRIVER`, signup enum `+DRIVER`, create `Driver` row on driver signup | Driver self-signup → PENDING profile |
| `auth.config.ts` | Add `/driver` role guard | Route-group protection for the new area |
| `app/(auth)/signup-form.tsx` | Add Driver radio option | Let users pick the driver role |
| `prisma/seed.ts` | Add APPROVED driver + a PAID `PLACED` order + a PAID `READY` order | Deterministic data for the rewritten restaurant E2E and the (Phase 3) driver pool |
| `e2e/restaurant.spec.ts` | Rewrite to stop at READY | Restaurant can no longer do the delivery leg |

No change needed: `types/next-auth.d.ts` (references `Role`, auto-updates), `lib/auth.ts`, `lib/db.ts`, `proxy.ts`.

---

## Task 1: Schema migration — Driver model, READY, DriverStatus, Order.driverId

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_driver_and_ready/migration.sql` (generated)

- [ ] **Step 1: Add `DRIVER` to the `Role` enum**

In `prisma/schema.prisma`, replace the `Role` enum:

```prisma
enum Role {
  CUSTOMER
  RESTAURANT
  DRIVER
  ADMIN
}
```

- [ ] **Step 2: Add `READY` to `OrderStatus`** (between `PREPARING` and `OUT_FOR_DELIVERY`)

```prisma
enum OrderStatus {
  PLACED
  ACCEPTED
  PREPARING
  READY
  OUT_FOR_DELIVERY
  DELIVERED
  REJECTED
  CANCELLED
}
```

- [ ] **Step 3: Add the `DriverStatus` enum** (place it right after `RestaurantStatus`)

```prisma
enum DriverStatus {
  PENDING
  APPROVED
  SUSPENDED
}
```

- [ ] **Step 4: Add the `Driver` model** (place it after the `Restaurant` model)

```prisma
model Driver {
  id        String       @id @default(cuid())
  userId    String       @unique
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  phone     String?
  status    DriverStatus @default(PENDING)
  orders    Order[]
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@index([status])
}
```

- [ ] **Step 5: Add the `driver` back-relation to `User`**

In the `User` model, add this line after `restaurant Restaurant?`:

```prisma
  driver       Driver?
```

- [ ] **Step 6: Add `driverId` + relation + index to `Order`**

In the `Order` model, add the driver fields (after the `restaurant` relation line) and the index (next to the existing `@@index` lines):

```prisma
  driverId         String?
  driver           Driver?            @relation(fields: [driverId], references: [id], onDelete: SetNull)
```

and add this index alongside the existing ones:

```prisma
  @@index([status, driverId])
```

- [ ] **Step 7: Create and apply the migration (also regenerates the client)**

Run: `pnpm prisma migrate dev --name add_driver_and_ready`
Expected: prints "Applying migration `..._add_driver_and_ready`", creates the SQL file under `prisma/migrations/`, then "✔ Generated Prisma Client".

> If Postgres errors with *"unsafe use of new value of enum type"*, split: run once to add only the enum values, then add the `Driver` table/`driverId` in a second `migrate dev`. (Not expected here — the migration only *defines* `READY`/`DRIVER`, it doesn't use them in DML.)

- [ ] **Step 8: Verify the generated client has the new enums + model**

Run: `grep -RE "READY|DRIVER" lib/generated/prisma/enums.ts && grep -R "Driver" lib/generated/prisma/models* 2>/dev/null | head`
Expected: `READY` and `DRIVER` appear in the generated enums.
(Do NOT run `pnpm build`/`tsc` yet — `lib/orders/state.ts`'s `Record<OrderStatus>` map is now missing a `READY` key and will not typecheck until Task 2. This is expected.)

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/generated/prisma
git commit -m "feat(schema): add Driver model, DRIVER role, READY state, Order.driverId"
```

---

## Task 2: State machine — add READY edges + actor authorization (TDD)

**Files:**
- Modify: `lib/orders/state.ts`
- Modify (test): `lib/orders/state.test.ts`

- [ ] **Step 1: Write the failing tests** — replace the entire contents of `lib/orders/state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canActorTransition,
  canTransition,
  IllegalTransitionError,
  isTerminal,
  nextStatuses,
  UnauthorizedActorError,
} from "./state";

describe("order state machine", () => {
  describe("legal transitions", () => {
    const legal: ReadonlyArray<[string, string]> = [
      ["PLACED", "ACCEPTED"],
      ["PLACED", "REJECTED"],
      ["PLACED", "CANCELLED"],
      ["ACCEPTED", "PREPARING"],
      ["PREPARING", "READY"],
      ["READY", "OUT_FOR_DELIVERY"],
      ["OUT_FOR_DELIVERY", "DELIVERED"],
    ];
    it.each(legal)("allows %s -> %s", (from, to) => {
      expect(canTransition(from as never, to as never)).toBe(true);
      expect(() => assertTransition(from as never, to as never)).not.toThrow();
    });
  });

  describe("illegal transitions", () => {
    const illegal: ReadonlyArray<[string, string]> = [
      ["PLACED", "DELIVERED"],
      ["PLACED", "PREPARING"],
      ["ACCEPTED", "DELIVERED"],
      ["ACCEPTED", "READY"], // must pass through PREPARING
      ["ACCEPTED", "CANCELLED"], // cancel only before acceptance
      ["PREPARING", "OUT_FOR_DELIVERY"], // now illegal: must pass through READY
      ["PREPARING", "ACCEPTED"],
      ["READY", "DELIVERED"], // must pass through OUT_FOR_DELIVERY
      ["READY", "PREPARING"],
      ["DELIVERED", "PLACED"],
      ["REJECTED", "ACCEPTED"],
      ["CANCELLED", "PLACED"],
      ["OUT_FOR_DELIVERY", "PREPARING"],
    ];
    it.each(illegal)("blocks %s -> %s", (from, to) => {
      expect(canTransition(from as never, to as never)).toBe(false);
      expect(() => assertTransition(from as never, to as never)).toThrow(
        IllegalTransitionError,
      );
    });
  });

  describe("isTerminal", () => {
    it.each(["DELIVERED", "REJECTED", "CANCELLED"])("%s is terminal", (s) =>
      expect(isTerminal(s as never)).toBe(true),
    );
    it.each(["PLACED", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY"])(
      "%s is not terminal",
      (s) => expect(isTerminal(s as never)).toBe(false),
    );
  });

  describe("nextStatuses", () => {
    it("returns the three branch options from PLACED", () => {
      expect([...nextStatuses("PLACED" as never)].sort()).toEqual(
        ["ACCEPTED", "CANCELLED", "REJECTED"].sort(),
      );
    });
    it("PREPARING leads only to READY", () => {
      expect(nextStatuses("PREPARING" as never)).toEqual(["READY"]);
    });
    it("READY leads only to OUT_FOR_DELIVERY", () => {
      expect(nextStatuses("READY" as never)).toEqual(["OUT_FOR_DELIVERY"]);
    });
    it("returns empty for a terminal state", () => {
      expect(nextStatuses("DELIVERED" as never)).toHaveLength(0);
    });
  });

  describe("actor authorization", () => {
    it("restaurant may drive the kitchen legs through READY", () => {
      expect(
        canActorTransition("PREPARING" as never, "READY" as never, "RESTAURANT"),
      ).toBe(true);
      expect(() =>
        assertTransition("PREPARING" as never, "READY" as never, "RESTAURANT"),
      ).not.toThrow();
    });
    it("restaurant may NOT perform the delivery legs", () => {
      expect(
        canActorTransition(
          "READY" as never,
          "OUT_FOR_DELIVERY" as never,
          "RESTAURANT",
        ),
      ).toBe(false);
      expect(() =>
        assertTransition(
          "READY" as never,
          "OUT_FOR_DELIVERY" as never,
          "RESTAURANT",
        ),
      ).toThrow(UnauthorizedActorError);
      expect(() =>
        assertTransition(
          "OUT_FOR_DELIVERY" as never,
          "DELIVERED" as never,
          "RESTAURANT",
        ),
      ).toThrow(UnauthorizedActorError);
    });
    it("driver may perform the delivery legs but not the kitchen legs", () => {
      expect(() =>
        assertTransition("READY" as never, "OUT_FOR_DELIVERY" as never, "DRIVER"),
      ).not.toThrow();
      expect(() =>
        assertTransition(
          "OUT_FOR_DELIVERY" as never,
          "DELIVERED" as never,
          "DRIVER",
        ),
      ).not.toThrow();
      expect(() =>
        assertTransition("PREPARING" as never, "READY" as never, "DRIVER"),
      ).toThrow(UnauthorizedActorError);
    });
    it("customer may only cancel a not-yet-accepted order", () => {
      expect(() =>
        assertTransition("PLACED" as never, "CANCELLED" as never, "CUSTOMER"),
      ).not.toThrow();
      expect(() =>
        assertTransition("PLACED" as never, "ACCEPTED" as never, "CUSTOMER"),
      ).toThrow(UnauthorizedActorError);
    });
    it("admin is allowed on every legal edge", () => {
      const edges: ReadonlyArray<[string, string]> = [
        ["PLACED", "ACCEPTED"],
        ["PLACED", "REJECTED"],
        ["PLACED", "CANCELLED"],
        ["ACCEPTED", "PREPARING"],
        ["PREPARING", "READY"],
        ["READY", "OUT_FOR_DELIVERY"],
        ["OUT_FOR_DELIVERY", "DELIVERED"],
      ];
      for (const [from, to] of edges) {
        expect(() =>
          assertTransition(from as never, to as never, "ADMIN"),
        ).not.toThrow();
      }
    });
    it("graph illegality beats actor: even admin cannot make an illegal jump", () => {
      expect(() =>
        assertTransition("PLACED" as never, "DELIVERED" as never, "ADMIN"),
      ).toThrow(IllegalTransitionError);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `canActorTransition`/`UnauthorizedActorError` are not exported yet, and `PREPARING -> READY` is not yet legal.

- [ ] **Step 3: Implement the new state machine** — replace the entire contents of `lib/orders/state.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test`
Expected: PASS — all state-machine tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/orders/state.ts lib/orders/state.test.ts
git commit -m "feat(orders): add READY state and actor-aware transitions"
```

---

## Task 3: Restaurant order actions + UI — stop at READY (fixes the build break)

**Files:**
- Modify: `app/(restaurant)/restaurant/orders/[id]/actions.ts`
- Modify: `app/(restaurant)/_components/order-actions.tsx`
- Modify: `app/(restaurant)/_lib/format.ts`
- Modify: `app/(restaurant)/_components/status-badge.tsx`

- [ ] **Step 1: Rewrite the restaurant order actions** — replace the entire contents of `app/(restaurant)/restaurant/orders/[id]/actions.ts`:

```ts
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
```

- [ ] **Step 2: Update the order-actions component** — replace the imports block (lines 5–11) and the `ACTION_FOR` map in `app/(restaurant)/_components/order-actions.tsx`.

Replace the import of the actions:

```tsx
import {
  acceptOrder,
  rejectOrder,
  startPreparing,
  markReady,
} from "@/app/(restaurant)/restaurant/orders/[id]/actions";
```

Replace the `ACTION_FOR` map:

```tsx
const ACTION_FOR: Record<OrderStatus, ((orderId: string) => Promise<void>) | undefined> = {
  ACCEPTED: acceptOrder,
  REJECTED: rejectOrder,
  PREPARING: startPreparing,
  READY: markReady,
  OUT_FOR_DELIVERY: undefined, // driver-driven (claim from pool), never a restaurant button
  DELIVERED: undefined, // driver-driven
  PLACED: undefined, // PLACED is never a transition target here
  CANCELLED: undefined, // customer/admin-only branch
};
```

(The rest of the file is unchanged — `nextStatuses(status).filter((t) => ACTION_FOR[t])` now renders "Mark ready" on a PREPARING order and "No further actions for this order." once READY, because `ACTION_FOR[OUT_FOR_DELIVERY]` is `undefined`.)

- [ ] **Step 3: Add READY labels** — in `app/(restaurant)/_lib/format.ts`, replace the `statusLabel` map and the `actionLabel` map:

```ts
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

export function actionLabel(to: OrderStatus): string {
  const map: Partial<Record<OrderStatus, string>> = {
    ACCEPTED: "Accept",
    REJECTED: "Reject",
    PREPARING: "Start preparing",
    READY: "Mark ready",
    OUT_FOR_DELIVERY: "Out for delivery", // kept for the (Phase 3) driver UI
    DELIVERED: "Mark delivered", // kept for the (Phase 3) driver UI
  };
  return map[to] ?? statusLabel(to);
}
```

- [ ] **Step 4: Add a READY badge color** — in `app/(restaurant)/_components/status-badge.tsx`, replace the `STYLES` map:

```ts
const STYLES: Record<OrderStatus, string> = {
  PLACED: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-amber-100 text-amber-800",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-teal-100 text-teal-800",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-200 text-gray-700",
};
```

- [ ] **Step 5: Verify it compiles**

Run: `pnpm build`
Expected: build succeeds (no missing-export error from `order-actions.tsx`, no non-exhaustive `Record<OrderStatus>` error).

- [ ] **Step 6: Commit**

```bash
git add "app/(restaurant)/restaurant/orders/[id]/actions.ts" "app/(restaurant)/_components/order-actions.tsx" "app/(restaurant)/_lib/format.ts" "app/(restaurant)/_components/status-badge.tsx"
git commit -m "feat(restaurant): drive orders to READY only; delivery leg is driver-only"
```

---

## Task 4: Restaurant queue — add a "Ready · awaiting driver" column

**Files:**
- Modify: `app/(restaurant)/_lib/queue.ts`
- Modify: `app/(restaurant)/_components/queue-board.tsx`

- [ ] **Step 1: Add the `ready` bucket to the queue query** — in `app/(restaurant)/_lib/queue.ts`, replace the `QueueData` type, the state-group constants, and the `return` block of `getQueue`:

```ts
export type QueueData = {
  new: QueueOrder[];
  ready: QueueOrder[];
  inProgress: QueueOrder[];
  completed: QueueOrder[];
};

const NEW_STATES: OrderStatus[] = ["PLACED"];
const READY_STATES: OrderStatus[] = ["READY"];
const IN_PROGRESS_STATES: OrderStatus[] = ["ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY"];
const COMPLETED_STATES: OrderStatus[] = ["DELIVERED", "REJECTED", "CANCELLED"];
```

and the `return` in `getQueue`:

```ts
  return {
    new: mapped.filter((o) => NEW_STATES.includes(o.status)),
    ready: mapped.filter((o) => READY_STATES.includes(o.status)),
    inProgress: mapped.filter((o) => IN_PROGRESS_STATES.includes(o.status)),
    completed: mapped.filter((o) => COMPLETED_STATES.includes(o.status)),
  };
```

- [ ] **Step 2: Render the Ready column** — in `app/(restaurant)/_components/queue-board.tsx`, replace the column block inside the returned `<div>` of `QueueBoard`:

```tsx
    <div className="flex flex-col gap-6 md:flex-row">
      <Column
        title="New"
        orders={queue.new}
        cta="Open"
        emptyText="No incoming orders. New paid orders appear here."
      />
      <Column
        title="Ready · awaiting driver"
        orders={queue.ready}
        cta="Open"
        emptyText="Nothing ready for pickup."
      />
      <Column title="In progress" orders={queue.inProgress} cta="Open" emptyText="Nothing in progress." />
      <Column title="Completed" orders={queue.completed} cta="View" emptyText="No completed orders yet." />
    </div>
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "app/(restaurant)/_lib/queue.ts" "app/(restaurant)/_components/queue-board.tsx"
git commit -m "feat(restaurant): show a 'Ready · awaiting driver' queue column"
```

---

## Task 5: Admin — READY/DRIVER badge tones + Ready order filter

**Files:**
- Modify: `app/(admin)/_components/badge.tsx`
- Modify: `app/(admin)/admin/orders/page.tsx`

- [ ] **Step 1: Add tones** — in `app/(admin)/_components/badge.tsx`, add a `READY` order tone and a `DRIVER` role tone to the `TONE` map. Replace the order-statuses block and the roles block:

```ts
  // Order statuses
  PLACED: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-indigo-100 text-indigo-800",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-teal-100 text-teal-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-200 text-gray-700",
  // Roles (reused as plain pills)
  CUSTOMER: "bg-gray-100 text-gray-700",
  RESTAURANT: "bg-sky-100 text-sky-800",
  DRIVER: "bg-teal-100 text-teal-800",
  ADMIN: "bg-fuchsia-100 text-fuchsia-800",
```

- [ ] **Step 2: Add the Ready filter option** — in `app/(admin)/admin/orders/page.tsx`, replace the `FILTER_OPTIONS` array:

```ts
const FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Placed", value: "PLACED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Preparing", value: "PREPARING" },
  { label: "Ready", value: "READY" },
  { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
];
```

(`parseStatus` uses `raw in OrderStatus`, so it accepts `READY` automatically now that the enum has it — no change needed.)

- [ ] **Step 3: Verify it compiles**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/_components/badge.tsx" "app/(admin)/admin/orders/page.tsx"
git commit -m "feat(admin): support READY status and DRIVER role in badges + order filter"
```

---

## Task 6: Auth — enable the DRIVER role end-to-end

**Files:**
- Modify: `app/(auth)/actions.ts`
- Modify: `auth.config.ts`
- Modify: `app/(auth)/signup-form.tsx`

- [ ] **Step 1: Route drivers home + create their profile on signup** — in `app/(auth)/actions.ts`, replace the `ROLE_HOME` map, the `signUpSchema`, and the user-creation block of `signUpAction`.

Replace `ROLE_HOME`:

```ts
const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  RESTAURANT: "/restaurant",
  DRIVER: "/driver",
  CUSTOMER: "/browse",
};
```

Replace `signUpSchema`:

```ts
const signUpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["CUSTOMER", "RESTAURANT", "DRIVER"]),
});
```

Replace the password-hash + user-create block inside `signUpAction` (currently the single `await prisma.user.create(...)` line):

```ts
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
  });

  // A driver needs a Driver profile (starts PENDING; an admin approves it
  // before the driver can claim orders). Restaurants build their profile on a
  // dedicated onboarding screen, so only DRIVER gets an auto-created row here.
  if (role === "DRIVER") {
    await prisma.driver.create({ data: { userId: user.id, name } });
  }
```

- [ ] **Step 2: Guard the `/driver` route group** — in `auth.config.ts`, add the driver guard to `authorized` (before the `CUSTOMER_PREFIXES` check):

```ts
      if (pathname.startsWith("/admin")) return role === "ADMIN";
      if (pathname.startsWith("/restaurant")) return role === "RESTAURANT";
      if (pathname.startsWith("/driver")) return role === "DRIVER";
      if (CUSTOMER_PREFIXES.some((p) => pathname.startsWith(p))) return Boolean(auth);
      return true;
```

- [ ] **Step 3: Add the Driver radio option** — in `app/(auth)/signup-form.tsx`, replace the role radios `<div>` (inside the `<fieldset>`):

```tsx
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="CUSTOMER" defaultChecked /> Customer
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="RESTAURANT" /> Restaurant
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="role" value="DRIVER" /> Driver
          </label>
        </div>
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm build`
Expected: build succeeds (`ROLE_HOME` is now exhaustive for the 4-value `Role`; `prisma.driver` exists).

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/actions.ts" auth.config.ts "app/(auth)/signup-form.tsx"
git commit -m "feat(auth): support DRIVER signup, profile creation, and /driver route guard"
```

---

## Task 7: Seed — APPROVED driver + a PAID PLACED order + a PAID READY order

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Replace the seed `main()` body** — in `prisma/seed.ts`, replace the whole `async function main() { ... }` with the version below (keeps the existing admin/owner/restaurant/menu/customer upserts, captures `customer`, adds the driver, and seeds two paid orders idempotently):

```ts
async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: "admin@demo.test" },
    update: {},
    create: { email: "admin@demo.test", name: "Admin", role: "ADMIN", passwordHash },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.test" },
    update: {},
    create: { email: "owner@demo.test", name: "Mario", role: "RESTAURANT", passwordHash },
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { ownerId: owner.id },
    update: {},
    create: {
      ownerId: owner.id,
      name: "Mario's Pizza",
      cuisine: "Pizza",
      status: "APPROVED",
      hours: "Mon–Sun 10:00–22:00",
      deliveryArea: "City center",
    },
  });

  // Only create a menu if this restaurant has none (keeps seed idempotent).
  const categoryCount = await prisma.menuCategory.count({
    where: { restaurantId: restaurant.id },
  });
  if (categoryCount === 0) {
    await prisma.menuCategory.create({
      data: {
        restaurantId: restaurant.id,
        name: "Mains",
        sortOrder: 0,
        items: {
          create: [
            { name: "Margherita", description: "Classic tomato & mozzarella", priceCents: 900 },
            { name: "Pepperoni", description: "Pepperoni & cheese", priceCents: 1100 },
          ],
        },
      },
    });
  }

  const customer = await prisma.user.upsert({
    where: { email: "customer@demo.test" },
    update: {},
    create: { email: "customer@demo.test", name: "Maya", role: "CUSTOMER", passwordHash },
  });

  // Approved driver (mirrors the restaurant-approval pattern).
  const driverUser = await prisma.user.upsert({
    where: { email: "driver@demo.test" },
    update: {},
    create: { email: "driver@demo.test", name: "Dev", role: "DRIVER", passwordHash },
  });
  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      name: "Dev",
      phone: "+91 90000 00000",
      status: "APPROVED",
    },
  });

  // Two PAID orders so flows are exercisable without running checkout:
  //  - one PLACED  -> the restaurant queue's "New" column / restaurant E2E
  //  - one READY (driverId=null) -> the driver pickup pool (Phase 3)
  // Idempotent: only seed orders if there are none yet.
  const DELIVERY_FEE_CENTS = 299;
  const orderCount = await prisma.order.count();
  if (orderCount === 0) {
    // PAID PLACED order: 2x Margherita.
    const placedSubtotal = 900 * 2;
    const placed = await prisma.order.create({
      data: {
        customerId: customer.id,
        restaurantId: restaurant.id,
        status: "PLACED",
        subtotalCents: placedSubtotal,
        deliveryFeeCents: DELIVERY_FEE_CENTS,
        totalCents: placedSubtotal + DELIVERY_FEE_CENTS,
        addressLine: "12 MG Road, Bengaluru",
        items: {
          create: [{ name: "Margherita", priceCents: 900, quantity: 2 }],
        },
        payment: { create: { status: "PAID" } },
        events: { create: [{ from: null, to: "PLACED", byUserId: customer.id }] },
      },
    });

    // PAID READY order (unclaimed): 1x Pepperoni, with a full event trail.
    const readySubtotal = 1100;
    const ready = await prisma.order.create({
      data: {
        customerId: customer.id,
        restaurantId: restaurant.id,
        status: "READY",
        subtotalCents: readySubtotal,
        deliveryFeeCents: DELIVERY_FEE_CENTS,
        totalCents: readySubtotal + DELIVERY_FEE_CENTS,
        addressLine: "8 Brigade Road, Bengaluru",
        driverId: null,
        items: {
          create: [{ name: "Pepperoni", priceCents: 1100, quantity: 1 }],
        },
        payment: { create: { status: "PAID" } },
        events: {
          create: [
            { from: null, to: "PLACED", byUserId: customer.id },
            { from: "PLACED", to: "ACCEPTED", byUserId: owner.id },
            { from: "ACCEPTED", to: "PREPARING", byUserId: owner.id },
            { from: "PREPARING", to: "READY", byUserId: owner.id },
          ],
        },
      },
    });

    console.log(`Seeded orders: PLACED ${placed.id}, READY ${ready.id}`);
  }

  console.log(
    `Seeded admin@demo.test, owner@demo.test, customer@demo.test, driver@demo.test (password: ${SEED_PASSWORD})`,
  );
}
```

- [ ] **Step 2: Run the seed**

Run: `pnpm db:seed`
Expected: prints the "Seeded orders: PLACED … READY …" line and the accounts line, exits 0. Re-running prints only the accounts line (orders not duplicated).

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(seed): add approved driver + PAID PLACED and READY orders"
```

---

## Task 8: Rewrite the restaurant E2E to stop at READY + full green gate

**Files:**
- Modify: `e2e/restaurant.spec.ts`

- [ ] **Step 1: Replace the whole E2E spec** — replace the entire contents of `e2e/restaurant.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

// Restaurant fulfillment happy path (post-Phase-1): accept -> start preparing
// -> mark ready, driven through the UI. The restaurant can NO LONGER mark an
// order out-for-delivery or delivered — that is the driver's leg.
//
// Seeded accounts (password123): owner@demo.test owns "Mario's Pizza"
// (APPROVED). The seed creates one PAID PLACED order for it, so the New column
// is non-empty.
//
// PRECONDITION: run `pnpm prisma migrate dev` and `pnpm db:seed` first.
//
// NOT covered: the payment gate (unpaid orders never appearing), the driver
// claim/deliver leg, role-isolation negatives, menu/profile CRUD.

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill("owner@demo.test");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/restaurant");
}

test("owner advances a paid order accept -> prepare -> ready", async ({ page }) => {
  await signInAsOwner(page);

  // The New column lists paid PLACED orders. Open the first one.
  const newColumn = page.locator("section", { hasText: "New" }).first();
  await expect(newColumn).toBeVisible();

  const firstOpen = newColumn.getByRole("link", { name: "Open" }).first();
  await firstOpen.click();
  await expect(page).toHaveURL(/\/restaurant\/orders\/.+/);

  // PLACED -> show Accept + Reject; click Accept.
  await expect(page.getByText("Placed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();

  // ACCEPTED -> Start preparing.
  await page.getByRole("button", { name: "Start preparing" }).click();
  await expect(page.getByText("Preparing", { exact: true })).toBeVisible();

  // PREPARING -> Mark ready (the restaurant's last legal step).
  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();

  // The delivery leg is driver-only, so the restaurant sees no more actions.
  await expect(
    page.getByText("No further actions for this order."),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run the restaurant E2E**

Run: `pnpm test:e2e e2e/restaurant.spec.ts`
Expected: PASS (the seeded PAID PLACED order is advanced to READY; "No further actions" appears).
(If it can't find the dev server, ensure `pnpm dev` is running or that `playwright.config.ts` is configured to start it; ensure the DB was migrated + seeded.)

- [ ] **Step 3: Full green gate — unit + build + all E2E**

Run: `pnpm test && pnpm build && pnpm test:e2e`
Expected: Vitest green (state machine), production build succeeds, all Playwright specs (`auth`, `admin`, `restaurant`) pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/restaurant.spec.ts
git commit -m "test(e2e): restaurant fulfillment stops at READY (delivery leg is driver-only)"
```

---

## Self-review

**Spec coverage** (Phase 1 of the roadmap):
- Additive migration (DRIVER, READY, DriverStatus, Driver, Order.driverId, index) → Task 1 ✅
- State machine READY + actor model (`assertTransition(from,to,actor?)`, `TRANSITION_ACTORS`, `UnauthorizedActorError`) → Task 2 ✅
- Restaurant actions: remove delivery leg, add `markReady`, RESTAURANT actor → Task 3 ✅
- `order-actions.tsx`, `format.ts`, `status-badge.tsx` → Task 3 ✅
- Queue READY bucket (`queue.ts` + `queue-board.tsx`) → Task 4 ✅
- Admin badge tones + orders filter → Task 5 ✅
- Auth: ROLE_HOME, signup enum + Driver row, `/driver` guard, signup form → Task 6 ✅
- Seed: approved driver + PAID PLACED order + PAID READY order → Task 7 ✅
- `state.test.ts` updates → Task 2; `e2e/restaurant.spec.ts` rewrite → Task 8 ✅

**Type/name consistency:** `markReady` (action) used in Task 3 actions.ts and Task 3 `ACTION_FOR`. `assertTransition(from,to,actor?)`, `canActorTransition`, `UnauthorizedActorError`, `Actor` defined in Task 2 and consumed in Task 3. `QueueData.ready` added in Task 4 `queue.ts` and consumed in Task 4 `queue-board.tsx`. `prisma.driver` used in Task 6/7 is created in Task 1. `Role` exhaustiveness (`ROLE_HOME`) satisfied in Task 6.

**Sequencing note:** the project does NOT fully typecheck between Task 1 and the end of Task 2 (the `Record<OrderStatus>` maps lack `READY` until updated). Tasks 1→2→3→4→5→6 each restore green; do not run `pnpm build` as a gate until Task 3 onward. Vitest (Task 2) does not typecheck, so it is a valid gate for the state machine in isolation.

**No placeholders:** every step has the exact file, full code, command, and expected result.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-13-phase-1-lifecycle-driver-schema.md`. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task with review between tasks; fast iteration, isolated context per task.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

Which approach?
