# Phase 3 — Driver Module + Admin Driver Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin approves a driver; the approved driver sees a shared pickup pool, **atomically** claims a `READY` order (→ `OUT_FOR_DELIVERY`), delivers it (→ `DELIVERED`), and sees an earnings tally — closing the four-sided delivery loop.

**Architecture:** Server Components for reads (pool, order detail, earnings, history, admin drivers). Mutations are Server Actions ending in `revalidatePath`; the polled pickup-pool JSON is a Route Handler with the `{ ok, data, error }` envelope (mirrors the restaurant queue). The claim is a **single conditional `updateMany`** (`where status=READY AND driverId=null`) — first-come wins, a 0-row result means "already taken", no read-then-write race. Two-layer authz: the proxy gates `/driver` to the DRIVER role; every action re-resolves the caller's own `Driver` via `requireApprovedDriver()` and acts only on orders they claimed.

**Tech Stack:** Next.js 16 (App Router, Server Actions, Route Handlers), React 19, Prisma 7 (`@/lib/generated/prisma`, singleton `@/lib/db`), Tailwind v4 + shadcn/ui, SWR (polling), Vitest (unit), Playwright (E2E).

---

## Context the implementer must know (read before starting)

- **This worktree builds against the Phase 1 seed**, which already provides an APPROVED driver (`driver@demo.test`) and one PAID, unclaimed `READY` order (the pool fixture). Phase 3 does **not** depend on Phase 2's customer UI to build or test the driver leg.
- **Prisma import gotcha:** client from `@/lib/generated/prisma/client`, enums/types from `@/lib/generated/prisma/enums`, singleton `import { prisma } from "@/lib/db"`. Never `@prisma/client` / `new PrismaClient()`. (`.claude/rules/data-access.md`)
- **Two-layer authz** (`.claude/rules/authorization.md`): the proxy only checks role. Re-verify ownership in every action/page. A driver acts only on orders **they claimed**; claiming requires `status === APPROVED`.
- **State machine** (`lib/orders/state.ts`) is the single source of truth. Driver legs: `READY → OUT_FOR_DELIVERY` and `OUT_FOR_DELIVERY → DELIVERED`, actor `"DRIVER"` (ADMIN also allowed). Always `assertTransition(from, to, "DRIVER")` and append an `OrderStatusEvent` in the same transaction.
- **Atomic claim is the crown jewel** (CLAUDE.md): claim with `prisma.order.updateMany({ where: { id, status: "READY", driverId: null }, data: { status: "OUT_FOR_DELIVERY", driverId } })`. If `count === 0`, the order was already taken → throw, write **no** event. NEVER read-then-write. (`READY` implies PAID — an order only reaches READY by going through the payment-gated restaurant queue — so the scalar `where` is sufficient and reliable.)
- **Earnings = display only** (no payouts): `sum(deliveryFeeCents)` over this driver's `DELIVERED` orders. Integer cents.
- **Patterns to mirror:**
  - Ownership helper: `app/(restaurant)/_lib/restaurant.ts` → mirror as `app/(driver)/_lib/driver.ts`.
  - Advance action shape: `app/(restaurant)/restaurant/orders/[id]/actions.ts` (resolve scope → load + ownership-check → `assertTransition` → `$transaction([update, event])` → `revalidatePath`).
  - SWR poll: `app/(restaurant)/_components/queue-board.tsx` + `app/(restaurant)/restaurant/orders/queue/route.ts`.
  - Admin approve/suspend: `app/(admin)/admin/restaurants/{actions.ts,page.tsx}` + `assertAdmin()` → mirror for drivers.
  - Admin overview KPIs: `app/(admin)/admin/page.tsx` (StatCard grid + `Promise.all` counts).
  - Shared shell: `app/(restaurant)/_components/dashboard-shell.tsx` + `restaurant-nav.tsx` → mirror a driver shell.
  - Money/labels: reuse `app/(restaurant)/_lib/format.ts` (`formatCents`, `statusLabel`, `orderRef`) — import directly; do NOT duplicate.
  - `Badge` (`app/(admin)/_components/badge.tsx`) already colors `PENDING/APPROVED/SUSPENDED` — reuse for driver status.
- **shadcn/ui available:** `button`, `card`, `input`, `label` only. `lucide-react` icons are available (used by admin/restaurant nav).
- **Auth/route guard already done in Phase 1:** `auth.config.ts` gates `/driver` to role DRIVER; driver signup creates a PENDING `Driver` row; `ROLE_HOME.DRIVER = "/driver"`. Do NOT edit `auth.config.ts` / `proxy.ts`.
- **Next.js 16:** `params` is a Promise — `await params`. Route Handlers/pages read it the same way as the restaurant queue route + order detail page.
- **`AppHeader`** is an async Server Component (`components/app-header.tsx`) — render it only from Server Components.

## File structure (created/modified in this phase)

| File | Responsibility |
|---|---|
| `app/(driver)/_lib/driver.ts` | `getDriver()` / `requireApprovedDriver()` ownership helpers. NEW |
| `app/(driver)/_lib/deliveries.ts` | `sumDeliveredFees` (pure) + `getEarnings`, `getMyDeliveries` (DB). NEW |
| `lib/orders/claim.ts` | `AlreadyClaimedError` + `assertClaimed(count)` (pure contract of the atomic claim). NEW |
| `lib/orders/claim.test.ts` | Unit tests for `assertClaimed`. NEW |
| `app/(driver)/_lib/deliveries.test.ts` | Unit tests for `sumDeliveredFees`. NEW |
| `app/(driver)/_components/driver-shell.tsx` | Header + driver nav + content slot (mirrors restaurant shell). NEW |
| `app/(driver)/_components/driver-nav.tsx` | Driver nav rail (Pool / Deliveries / Earnings). NEW |
| `app/(driver)/_components/pool-board.tsx` | Client SWR pool list (polls every 5s). NEW |
| `app/(driver)/driver/page.tsx` | Entry: APPROVED → pool; PENDING/none → awaiting-approval screen. NEW |
| `app/(driver)/driver/pool/route.ts` | Polled JSON `{ ok, data, error }`: unclaimed PAID READY orders. NEW |
| `app/(driver)/driver/order/[id]/page.tsx` | Order detail: Claim (if claimable) or Mark delivered (if mine). NEW |
| `app/(driver)/driver/order/[id]/actions.ts` | `claimOrder` (atomic) + `markDelivered`. NEW |
| `app/(driver)/driver/order/[id]/_components/claim-button.tsx` | Client claim button. NEW |
| `app/(driver)/driver/order/[id]/_components/deliver-button.tsx` | Client mark-delivered button. NEW |
| `app/(driver)/driver/deliveries/page.tsx` | Active + past deliveries for this driver. NEW |
| `app/(driver)/driver/earnings/page.tsx` | Earnings tally (sum of delivered fees). NEW |
| `app/(admin)/admin/drivers/actions.ts` | `approveDriver` / `suspendDriver` (admin-only). NEW |
| `app/(admin)/admin/drivers/page.tsx` | Admin driver list + approve/suspend (mirrors restaurants). NEW |
| `app/(admin)/_components/admin-nav.tsx` | Add a "Drivers" nav link. MODIFY |
| `app/(admin)/admin/page.tsx` | Add driver KPIs (total / pending drivers). MODIFY |
| `prisma/seed.ts` | Add a SECOND approved driver (`driver2@demo.test`) for the race test. MODIFY |
| `e2e/driver.spec.ts` | Claim→deliver, already-claimed, PENDING-can't-claim, earnings, admin approve. NEW |

> **Merge note:** `prisma/seed.ts` and `app/(admin)/admin/page.tsx` are also touched by other phases — expect a small merge conflict when this branch merges into `Abhi/qwikbite`; keep both sides' additive blocks.

---

## Task 1: Driver ownership helpers

**Files:**
- Create: `app/(driver)/_lib/driver.ts`

Mirrors `app/(restaurant)/_lib/restaurant.ts`. No isolated unit test (wraps `auth()` + a findUnique); verified by build + Task 11 E2E.

- [ ] **Step 1: Write the helper**

```ts
// app/(driver)/_lib/driver.ts
// Driver scope helpers — the SECOND authorization layer for driver data. The
// proxy only checks the DRIVER role; only an APPROVED driver may claim/deliver,
// and a driver acts only on orders they claimed. Mirrors restaurant.ts.
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** The Driver row for the current session user, or null. Use in pages (e.g. to
 *  render an awaiting-approval screen for a PENDING driver). */
export async function getDriver() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.driver.findUnique({ where: { userId } });
}

/** Like getDriver but throws unless the driver exists AND is APPROVED. Use inside
 *  Server Actions that claim/deliver. Returns the driver + userId (for events). */
export async function requireApprovedDriver() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const driver = await prisma.driver.findUnique({ where: { userId } });
  if (!driver) throw new Error("No driver profile for this account");
  if (driver.status !== "APPROVED") throw new Error("Driver is not approved");

  return { driver, userId };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build` (or `pnpm exec tsc --noEmit`)
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(driver)/_lib/driver.ts"
git commit -m "feat(driver): approved-driver ownership helpers (Phase 3)"
```

---

## Task 2: Atomic-claim contract (pure) + unit tests

**Files:**
- Create: `lib/orders/claim.ts`
- Test: `lib/orders/claim.test.ts`

The atomic claim itself is a DB conditional update (Task 6). This file captures its **contract** as a tiny pure helper so the "0 rows ⇒ already claimed" rule is unit-tested and reused.

- [ ] **Step 1: Write the failing test**

```ts
// lib/orders/claim.test.ts
import { describe, expect, it } from "vitest";
import { assertClaimed, AlreadyClaimedError } from "./claim";

describe("atomic claim contract", () => {
  it("treats an updateMany count of 1 as a successful claim (no throw)", () => {
    expect(() => assertClaimed(1)).not.toThrow();
  });

  it("treats 0 rows as already-claimed and throws AlreadyClaimedError", () => {
    expect(() => assertClaimed(0)).toThrow(AlreadyClaimedError);
  });

  it("any non-positive count is already-claimed", () => {
    expect(() => assertClaimed(-1)).toThrow(AlreadyClaimedError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/orders/claim.test.ts`
Expected: FAIL — cannot find module `./claim`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/orders/claim.ts
// Contract of the first-come atomic claim. The claim is a conditional updateMany
// (where status=READY AND driverId=null); the DB reports how many rows it changed.
// 1 => this driver won the order. 0 => someone else already claimed it (or it is
// no longer READY) — throw, and write NO status event. (CLAUDE.md atomic claim.)
export class AlreadyClaimedError extends Error {
  constructor() {
    super("This order was already claimed by another driver.");
    this.name = "AlreadyClaimedError";
  }
}

/** Throw AlreadyClaimedError unless the conditional update changed exactly the row. */
export function assertClaimed(updatedCount: number): void {
  if (updatedCount < 1) throw new AlreadyClaimedError();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/orders/claim.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/orders/claim.ts lib/orders/claim.test.ts
git commit -m "feat(orders): atomic-claim contract helper + unit tests (Phase 3)"
```

---

## Task 3: Earnings + deliveries queries (pure money math + DB)

**Files:**
- Create: `app/(driver)/_lib/deliveries.ts`
- Test: `app/(driver)/_lib/deliveries.test.ts`

`sumDeliveredFees` is pure and unit-tested (money math). `getEarnings`/`getMyDeliveries` wrap Prisma (covered by E2E).

- [ ] **Step 1: Write the failing test**

```ts
// app/(driver)/_lib/deliveries.test.ts
import { describe, expect, it } from "vitest";
import { sumDeliveredFees } from "./deliveries";

describe("driver earnings math", () => {
  it("sums deliveryFeeCents over DELIVERED orders only", () => {
    const orders = [
      { status: "DELIVERED", deliveryFeeCents: 299 },
      { status: "DELIVERED", deliveryFeeCents: 199 },
      { status: "OUT_FOR_DELIVERY", deliveryFeeCents: 500 }, // not yet earned
    ] as const;
    expect(sumDeliveredFees(orders)).toBe(299 + 199);
  });

  it("is zero for no delivered orders", () => {
    expect(sumDeliveredFees([])).toBe(0);
    expect(sumDeliveredFees([{ status: "OUT_FOR_DELIVERY", deliveryFeeCents: 500 }] as const)).toBe(0);
  });

  it("returns an integer number of cents", () => {
    const orders = [{ status: "DELIVERED", deliveryFeeCents: 299 }] as const;
    expect(Number.isInteger(sumDeliveredFees(orders))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "app/(driver)/_lib/deliveries.test.ts"`
Expected: FAIL — cannot find module `./deliveries`.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run "app/(driver)/_lib/deliveries.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/(driver)/_lib/deliveries.ts" "app/(driver)/_lib/deliveries.test.ts"
git commit -m "feat(driver): earnings math + delivery queries (Phase 3)"
```

---

## Task 4: Driver shell + nav + entry/awaiting-approval screen

**Files:**
- Create: `app/(driver)/_components/driver-nav.tsx`
- Create: `app/(driver)/_components/driver-shell.tsx`
- Create: `app/(driver)/driver/page.tsx`

`/driver` is the entry: an APPROVED driver is redirected to the pool; a PENDING (or missing) driver sees an awaiting-approval screen. (A PENDING driver still has the DRIVER role, so they pass the route guard but `requireApprovedDriver` would throw — the page uses `getDriver`, not the require helper.)

- [ ] **Step 1: Write the driver nav (client)**

```tsx
// app/(driver)/_components/driver-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PackageSearch, Truck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/driver/pool", label: "Pickup pool", icon: PackageSearch },
  { href: "/driver/deliveries", label: "My deliveries", icon: Truck },
  { href: "/driver/earnings", label: "Earnings", icon: Wallet },
];

export function DriverNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-2">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Write the driver shell**

```tsx
// app/(driver)/_components/driver-shell.tsx
import { AppHeader } from "@/components/app-header";
import { DriverNav } from "@/app/(driver)/_components/driver-nav";

// Shell for all driver screens: shared AppHeader, a nav rail, and a content slot.
// Mirrors the restaurant DashboardShell.
export function DriverShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <AppHeader title="Driver" />
      <div className="mx-auto flex max-w-5xl gap-8 px-6 py-8">
        <aside className="w-52 shrink-0 self-start rounded-xl border bg-card p-2 shadow-sm">
          <DriverNav />
        </aside>
        <main className="min-w-0 flex-1">
          <h1 className="mb-6 text-2xl font-bold tracking-tight">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the entry page**

```tsx
// app/(driver)/driver/page.tsx
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { Badge } from "@/app/(admin)/_components/badge";
import { getDriver } from "@/app/(driver)/_lib/driver";

// Driver entry ("/driver"). APPROVED -> pickup pool. Otherwise an awaiting-approval
// screen (a PENDING driver passes the role guard but cannot claim yet).
export default async function DriverHomePage() {
  const driver = await getDriver();
  if (driver?.status === "APPROVED") redirect("/driver/pool");

  return (
    <DriverShell title="Welcome">
      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          {!driver ? (
            <p className="text-muted-foreground">
              No driver profile is linked to this account.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span>Application status:</span>
                <Badge value={driver.status} />
              </div>
              <p className="text-muted-foreground">
                {driver.status === "PENDING"
                  ? "Your application is awaiting admin approval. Once approved, the pickup pool unlocks."
                  : "Your account is suspended. Contact an admin."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </DriverShell>
  );
}
```

- [ ] **Step 4: Verify in the browser**

Run `pnpm db:seed` + `pnpm dev`. Sign in as `driver@demo.test` (APPROVED) → redirected to `/driver/pool` (404 until Task 5 — expected for now; just confirm the redirect fires). Temporarily, to see the awaiting screen, you can sign up a new driver via `/signup` (role Driver) → `/driver` shows "awaiting admin approval".

- [ ] **Step 5: Commit**

```bash
git add "app/(driver)/_components" "app/(driver)/driver/page.tsx"
git commit -m "feat(driver): shell + nav + entry/awaiting-approval screen (Phase 3)"
```

---

## Task 5: Pickup pool (list + polled route)

**Files:**
- Create: `app/(driver)/driver/pool/route.ts`
- Create: `app/(driver)/_components/pool-board.tsx`
- Create: `app/(driver)/driver/pool/page.tsx`

The pool shows unclaimed, PAID, `READY` orders to any APPROVED driver. Polled with SWR (mirrors the restaurant queue).

- [ ] **Step 1: Write the shared pool query + types**

Add to `app/(driver)/_lib/deliveries.ts` (same file as Task 3):

```ts
// --- append to app/(driver)/_lib/deliveries.ts ---

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
```

- [ ] **Step 2: Write the polled route**

```ts
// app/(driver)/driver/pool/route.ts
// JSON the pool board polls with SWR. Envelope { ok, data, error }. Gated by the
// proxy (DRIVER role) AND re-checked here: only an APPROVED driver sees the pool.
import { NextResponse } from "next/server";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { getPool } from "@/app/(driver)/_lib/deliveries";

export async function GET() {
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") {
    return NextResponse.json(
      { ok: false, data: null, error: "Driver is not approved" },
      { status: 403 },
    );
  }
  const data = await getPool();
  return NextResponse.json({ ok: true, data, error: null });
}
```

- [ ] **Step 3: Write the pool board (client SWR)**

```tsx
// app/(driver)/_components/pool-board.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCents, orderRef } from "@/app/(restaurant)/_lib/format";
import type { PoolOrder } from "@/app/(driver)/_lib/deliveries";

const fetcher = async (url: string): Promise<PoolOrder[]> => {
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(body.error ?? "Failed to load pool");
  return body.data as PoolOrder[];
};

// Polls the pool every 5s so claimed orders disappear and new READY orders appear
// without a reload (CLAUDE.md: polling, not push).
export function PoolBoard({ initial }: { initial: PoolOrder[] }) {
  const { data, error } = useSWR<PoolOrder[]>("/driver/pool", fetcher, {
    fallbackData: initial,
    refreshInterval: 5000,
  });

  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Couldn&apos;t load the pool. It will retry automatically.
      </p>
    );
  }

  const pool = data ?? initial;
  if (pool.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        No orders ready for pickup right now.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {pool.map((o) => (
        <Card key={o.id}>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{o.restaurantName}</span>
              <span className="text-xs text-muted-foreground">{orderRef(o.id)}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {o.itemCount} {o.itemCount === 1 ? "item" : "items"} · Earn{" "}
              {formatCents(o.deliveryFeeCents)}
            </span>
            <Button asChild size="sm" className="mt-1 self-start">
              <Link href={`/driver/order/${o.id}`}>View &amp; claim</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write the pool page**

```tsx
// app/(driver)/driver/pool/page.tsx
import { redirect } from "next/navigation";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { PoolBoard } from "@/app/(driver)/_components/pool-board";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { getPool } from "@/app/(driver)/_lib/deliveries";

// Pickup pool ("/driver/pool"). APPROVED drivers only; others bounce to /driver
// (the awaiting-approval screen).
export default async function PoolPage() {
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") redirect("/driver");

  const initial = await getPool();
  return (
    <DriverShell title="Pickup pool">
      <PoolBoard initial={initial} />
    </DriverShell>
  );
}
```

- [ ] **Step 5: Verify in the browser**

Sign in as `driver@demo.test` → `/driver/pool` shows the seeded READY order (Mario's, "Earn $2.99"). Open in a second browser as `customer@demo.test` etc. doesn't matter — confirm the card + "View & claim" link.

- [ ] **Step 6: Commit**

```bash
git add "app/(driver)/_lib/deliveries.ts" "app/(driver)/driver/pool" "app/(driver)/_components/pool-board.tsx"
git commit -m "feat(driver): pickup pool with SWR polling (Phase 3)"
```

---

## Task 6: Claim + deliver actions

**Files:**
- Create: `app/(driver)/driver/order/[id]/actions.ts`

`claimOrder` is the atomic conditional update; `markDelivered` re-checks the order belongs to this driver. Both append an event in the same transaction and use `assertTransition(..., "DRIVER")` defensively.

- [ ] **Step 1: Write the actions**

```ts
// app/(driver)/driver/order/[id]/actions.ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm build`
Expected: no errors. (Behavior is exercised in Tasks 7 + 11.)

- [ ] **Step 3: Commit**

```bash
git add "app/(driver)/driver/order/[id]/actions.ts"
git commit -m "feat(driver): atomic claim + deliver actions (Phase 3)"
```

---

## Task 7: Order detail (claim / active delivery)

**Files:**
- Create: `app/(driver)/driver/order/[id]/_components/claim-button.tsx`
- Create: `app/(driver)/driver/order/[id]/_components/deliver-button.tsx`
- Create: `app/(driver)/driver/order/[id]/page.tsx`

Shows the order to an APPROVED driver and offers exactly one action: **Claim** (if it's still a claimable pool order) or **Mark delivered** (if this driver already claimed it). Anything else is not actionable.

- [ ] **Step 1: Write the claim button (client)**

```tsx
// app/(driver)/driver/order/[id]/_components/claim-button.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { claimOrder } from "../actions";

export function ClaimButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await claimOrder(orderId);
            router.push("/driver/deliveries");
          } catch {
            // The order was taken (or no longer READY) — refresh to reflect reality.
            router.refresh();
          }
        })
      }
    >
      {pending ? "Claiming…" : "Claim this order"}
    </Button>
  );
}
```

- [ ] **Step 2: Write the deliver button (client)**

```tsx
// app/(driver)/driver/order/[id]/_components/deliver-button.tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markDelivered } from "../actions";

export function DeliverButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button disabled={pending} onClick={() => start(async () => { await markDelivered(orderId); })}>
      {pending ? "Updating…" : "Mark delivered"}
    </Button>
  );
}
```

- [ ] **Step 3: Write the order detail page**

```tsx
// app/(driver)/driver/order/[id]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { Badge } from "@/app/(admin)/_components/badge";
import { formatCents, orderRef } from "@/app/(restaurant)/_lib/format";
import { ClaimButton } from "./_components/claim-button";
import { DeliverButton } from "./_components/deliver-button";

// Driver order detail ("/driver/order/[id]"). APPROVED drivers only. Offers:
//   - Claim, if the order is still a claimable pool order (READY, unclaimed, PAID)
//   - Mark delivered, if THIS driver already claimed it (OUT_FOR_DELIVERY, driverId=me)
//   - otherwise: not actionable (claimed by someone else / already delivered).
export default async function DriverOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") redirect("/driver");

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      driverId: true,
      totalCents: true,
      subtotalCents: true,
      deliveryFeeCents: true,
      addressLine: true,
      restaurant: { select: { name: true } },
      items: { select: { name: true, quantity: true, priceCents: true } },
      payment: { select: { status: true } },
    },
  });
  if (!order) notFound();

  const isClaimable =
    order.status === "READY" &&
    order.driverId === null &&
    order.payment?.status === "PAID";
  const isMineActive = order.driverId === driver.id && order.status === "OUT_FOR_DELIVERY";

  return (
    <DriverShell title={`Order ${orderRef(order.id)}`}>
      <Link
        href="/driver/pool"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to pool
      </Link>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{order.restaurant.name}</CardTitle>
            <Badge value={order.status} />
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <span>Deliver to: {order.addressLine}</span>
            <span>Earn: {formatCents(order.deliveryFeeCents)}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {order.items.map((it, i) => (
              <div key={i} className="flex justify-between">
                <span>{it.name} × {it.quantity}</span>
                <span>{formatCents(it.priceCents * it.quantity)}</span>
              </div>
            ))}
            <div className="mt-2 border-t pt-2 font-semibold">
              Total {formatCents(order.totalCents)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action</CardTitle>
          </CardHeader>
          <CardContent>
            {isClaimable ? (
              <ClaimButton orderId={order.id} />
            ) : isMineActive ? (
              <DeliverButton orderId={order.id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                This order isn&apos;t available to you.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DriverShell>
  );
}
```

- [ ] **Step 4: Verify in the browser**

As `driver@demo.test`: open the seeded READY order from the pool → "Claim this order" → click → redirected to My deliveries, order now OUT_FOR_DELIVERY. Reopen it → "Mark delivered" → click → status DELIVERED. Open the same order's URL again → "This order isn't available to you."

- [ ] **Step 5: Commit**

```bash
git add "app/(driver)/driver/order/[id]"
git commit -m "feat(driver): order detail with claim / mark-delivered (Phase 3)"
```

---

## Task 8: Deliveries + earnings screens

**Files:**
- Create: `app/(driver)/driver/deliveries/page.tsx`
- Create: `app/(driver)/driver/earnings/page.tsx`

- [ ] **Step 1: Write the deliveries page**

```tsx
// app/(driver)/driver/deliveries/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { Badge } from "@/app/(admin)/_components/badge";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { getMyDeliveries } from "@/app/(driver)/_lib/deliveries";
import { formatCents, orderRef } from "@/app/(restaurant)/_lib/format";

// My deliveries ("/driver/deliveries"): active (out for delivery) + past (delivered),
// scoped to THIS driver.
export default async function DeliveriesPage() {
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") redirect("/driver");

  const { active, past } = await getMyDeliveries(driver.id);

  function Row({ o }: { o: { id: string; status: string; totalCents: number; restaurant: { name: string } } }) {
    return (
      <Link key={o.id} href={`/driver/order/${o.id}`} className="block">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{o.restaurant.name} · {orderRef(o.id)}</p>
              <Badge value={o.status} />
            </div>
            <span className="font-semibold">{formatCents(o.totalCents)}</span>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <DriverShell title="My deliveries">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing out for delivery.</p>
        ) : (
          <div className="flex flex-col gap-3">{active.map((o) => <Row key={o.id} o={o} />)}</div>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Delivered
        </h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed deliveries yet.</p>
        ) : (
          <div className="flex flex-col gap-3">{past.map((o) => <Row key={o.id} o={o} />)}</div>
        )}
      </section>
    </DriverShell>
  );
}
```

- [ ] **Step 2: Write the earnings page**

```tsx
// app/(driver)/driver/earnings/page.tsx
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { getEarnings, getMyDeliveries } from "@/app/(driver)/_lib/deliveries";
import { formatCents } from "@/app/(restaurant)/_lib/format";

// Earnings ("/driver/earnings"): total delivered-fee tally (display only, no
// payouts) + delivered count, scoped to THIS driver.
export default async function EarningsPage() {
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") redirect("/driver");

  const [totalCents, { past }] = await Promise.all([
    getEarnings(driver.id),
    getMyDeliveries(driver.id),
  ]);

  return (
    <DriverShell title="Earnings">
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="text-3xl font-bold tabular-nums">{formatCents(totalCents)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total earned (delivered fees)</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="text-3xl font-bold tabular-nums">{past.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">Deliveries completed</div>
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Earnings are display-only in this build (no payouts).
      </p>
    </DriverShell>
  );
}
```

- [ ] **Step 3: Verify in the browser**

After delivering the seeded order as `driver@demo.test`: `/driver/deliveries` shows it under Delivered; `/driver/earnings` shows "$2.99" total + "1" delivered.

- [ ] **Step 4: Commit**

```bash
git add "app/(driver)/driver/deliveries" "app/(driver)/driver/earnings"
git commit -m "feat(driver): deliveries list + earnings tally (Phase 3)"
```

---

## Task 9: Admin driver management

**Files:**
- Create: `app/(admin)/admin/drivers/actions.ts`
- Create: `app/(admin)/admin/drivers/page.tsx`
- Modify: `app/(admin)/_components/admin-nav.tsx`
- Modify: `app/(admin)/admin/page.tsx`

Mirrors the admin restaurants screen. Adds a Drivers nav link and driver KPIs to the overview.

- [ ] **Step 1: Write the driver admin actions**

```ts
// app/(admin)/admin/drivers/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Defense in depth (mirrors restaurants/actions.ts): re-verify ADMIN in the action.
async function assertAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden: admin role required.");
}

// Approve a driver (-> APPROVED, may now claim from the pool).
export async function approveDriver(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing driver id.");
  await prisma.driver.update({ where: { id }, data: { status: "APPROVED" } });
  revalidatePath("/admin/drivers");
}

// Suspend a driver (-> SUSPENDED, can no longer claim).
export async function suspendDriver(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing driver id.");
  await prisma.driver.update({ where: { id }, data: { status: "SUSPENDED" } });
  revalidatePath("/admin/drivers");
}
```

- [ ] **Step 2: Write the admin drivers page**

```tsx
// app/(admin)/admin/drivers/page.tsx
import { prisma } from "@/lib/db";
import { DriverStatus } from "@/lib/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/app/(admin)/_components/badge";
import { FilterBar } from "@/app/(admin)/_components/filter-bar";
import { Table, THead, TBody, TR, TH, TD } from "@/app/(admin)/_components/table";
import { approveDriver, suspendDriver } from "./actions";

// Admin Drivers ("/admin/drivers"). Lists drivers with an optional ?status= filter.
// Approve/Suspend run as Server Actions. Mirrors admin/restaurants/page.tsx.
const FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Suspended", value: "SUSPENDED" },
];

function parseStatus(raw: string | undefined): DriverStatus | undefined {
  if (raw && raw in DriverStatus) return raw as DriverStatus;
  return undefined;
}

export default async function AdminDriversPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = parseStatus(status);

  const drivers = await prisma.driver.findMany({
    where: filter ? { status: filter } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      user: { select: { email: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Drivers</h1>
        <FilterBar basePath="/admin/drivers" param="status" current={filter} options={FILTER_OPTIONS} />
      </div>

      {drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drivers match this filter.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {drivers.map((d) => (
              <TR key={d.id}>
                <TD className="font-medium">{d.name}</TD>
                <TD>{d.user.email}</TD>
                <TD>
                  <Badge value={d.status} />
                </TD>
                <TD>
                  <div className="flex justify-end gap-2">
                    {d.status !== "APPROVED" && (
                      <form action={approveDriver}>
                        <input type="hidden" name="id" value={d.id} />
                        <Button type="submit" size="sm">Approve</Button>
                      </form>
                    )}
                    {d.status !== "SUSPENDED" && (
                      <form action={suspendDriver}>
                        <input type="hidden" name="id" value={d.id} />
                        <Button type="submit" size="sm" variant="destructive">Suspend</Button>
                      </form>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the Drivers nav link**

In `app/(admin)/_components/admin-nav.tsx`, add the `Car` icon import and a link between Restaurants and Users:

```tsx
// change the import line to include Car:
import { LayoutDashboard, Store, Car, Users, ReceiptText } from "lucide-react";

// add to the LINKS array (after the Restaurants entry):
  { href: "/admin/drivers", label: "Drivers", icon: Car, exact: false },
```

- [ ] **Step 4: Add driver KPIs to the overview**

In `app/(admin)/admin/page.tsx`, extend the `Promise.all` and the StatCard grid:

```tsx
// add two queries inside the Promise.all destructuring (and to the array):
//   totalDrivers, pendingDrivers,
    prisma.driver.count(),
    prisma.driver.count({ where: { status: "PENDING" } }),

// add two StatCards to the grid:
        <StatCard label="Drivers" value={totalDrivers} />
        <StatCard label="Pending drivers" value={pendingDrivers} />
```

(Keep the existing cards; the grid already wraps with `sm:grid-cols-4`.)

- [ ] **Step 5: Verify in the browser**

As `admin@demo.test`: the sidebar shows **Drivers**; `/admin/drivers` lists `driver@demo.test` (APPROVED) with Suspend; filter to Pending shows none initially. Sign up a new driver via `/signup` → it appears as PENDING with an **Approve** button → Approve flips it to APPROVED. Overview shows "Drivers" + "Pending drivers" KPIs.

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/admin/drivers" "app/(admin)/_components/admin-nav.tsx" "app/(admin)/admin/page.tsx"
git commit -m "feat(admin): driver approval + KPIs (Phase 3)"
```

---

## Task 10: Seed a second approved driver (for the race test)

**Files:**
- Modify: `prisma/seed.ts`

The "already claimed" E2E needs two APPROVED drivers. Add `driver2@demo.test` (idempotent upsert), mirroring the existing driver block.

- [ ] **Step 1: Add the second driver to the seed**

In `prisma/seed.ts`, after the existing `driver@demo.test` block, add:

```ts
  // Second approved driver — for the atomic-claim "already claimed" E2E.
  const driverUser2 = await prisma.user.upsert({
    where: { email: "driver2@demo.test" },
    update: {},
    create: { email: "driver2@demo.test", name: "Dani", role: "DRIVER", passwordHash },
  });
  await prisma.driver.upsert({
    where: { userId: driverUser2.id },
    update: {},
    create: { userId: driverUser2.id, name: "Dani", phone: "+91 90000 00001", status: "APPROVED" },
  });
```

Also update the final `console.log` to mention `driver2@demo.test`.

- [ ] **Step 2: Verify the seed runs idempotently**

Run: `pnpm db:seed` twice. Expected: no duplicate-key errors; `driver2@demo.test` exists and is APPROVED.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "test(seed): second approved driver for atomic-claim test (Phase 3)"
```

---

## Task 11: E2E — driver claim/deliver + negatives

**Files:**
- Create: `e2e/driver.spec.ts`

Covers: claim→deliver happy path; the "already claimed" path (a second driver tries to claim a taken order — deterministic, no real concurrency needed); a PENDING driver cannot reach the pool; earnings reflect the delivered fee; admin approves a PENDING driver. No fixed sleeps.

- [ ] **Step 1: Write the E2E spec**

```ts
// e2e/driver.spec.ts
import { expect, test } from "@playwright/test";

// Driver module (Phase 3): admin approves drivers; an approved driver claims a
// READY order atomically, delivers it, and sees earnings. Negatives: a second
// driver claiming a taken order gets "not available"; a PENDING driver can't reach
// the pool.
//
// Seeded (password123): driver@demo.test + driver2@demo.test (both APPROVED),
// owner@demo.test (Mario's), admin@demo.test, and ONE PAID unclaimed READY order.
// PRECONDITION: pnpm prisma migrate dev && pnpm db:seed.
//
// NOT covered: real concurrency (the race is tested deterministically by claiming
// then re-claiming the same order), online/offline toggle (Phase 5), the full
// customer->driver loop (needs Phase 2 merged).

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Helper: open the single seeded READY order from the pool and return its URL.
async function openPoolOrder(page: import("@playwright/test").Page): Promise<string> {
  await page.goto("/driver/pool");
  await page.getByRole("link", { name: "View & claim" }).first().click();
  await expect(page).toHaveURL(/\/driver\/order\/.+/);
  return page.url();
}

// Happy path: claim -> deliver -> earnings.
test("approved driver claims a READY order, delivers it, and earns the fee", async ({ page }) => {
  await signIn(page, "driver@demo.test");
  await expect(page).toHaveURL("/driver/pool");

  await openPoolOrder(page);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Claim this order" }).click();

  // Lands on My deliveries; the order is now active (out for delivery).
  await expect(page).toHaveURL("/driver/deliveries");
  await expect(page.getByText("OUT_FOR_DELIVERY")).toBeVisible();

  // Open it and mark delivered.
  await page.getByRole("link", { name: /View|Mario/ }).first().click();
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(page.getByText("DELIVERED")).toBeVisible();

  // Earnings reflect the $2.99 delivery fee.
  await page.goto("/driver/earnings");
  await expect(page.getByText("$2.99")).toBeVisible();
});

// Negative: a second driver cannot claim an order the first already took.
test("second driver cannot claim an already-claimed order", async ({ page }) => {
  // Driver 1 claims the seeded READY order.
  await signIn(page, "driver@demo.test");
  const orderUrl = await openPoolOrder(page);
  await page.getByRole("button", { name: "Claim this order" }).click();
  await expect(page).toHaveURL("/driver/deliveries");

  // Driver 2 navigates straight to that order — it is no longer claimable.
  await signIn(page, "driver2@demo.test");
  await page.goto(orderUrl);
  await expect(page.getByText("This order isn't available to you.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Claim this order" })).toHaveCount(0);
});

// Negative: a PENDING driver cannot reach the pool (bounced to the awaiting screen).
test("a pending driver is kept out of the pool", async ({ page }) => {
  // Create a fresh driver via signup (role Driver) -> PENDING.
  const email = `pending+${Date.now()}@demo.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Pat Pending");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("radio", { name: "Driver" }).check();
  await page.getByRole("button", { name: "Create account" }).click();

  // Signup lands on /driver; a PENDING driver sees the awaiting-approval screen.
  await expect(page).toHaveURL(/\/driver/);
  await expect(page.getByText(/awaiting admin approval/i)).toBeVisible();

  // Direct navigation to the pool bounces back to /driver.
  await page.goto("/driver/pool");
  await expect(page).toHaveURL("/driver");
});

// Admin approves a PENDING driver -> they gain pool access.
test("admin approves a pending driver", async ({ page }) => {
  const email = `approve+${Date.now()}@demo.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ada Approve");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("radio", { name: "Driver" }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/driver/);

  // Admin approves them.
  await signIn(page, "admin@demo.test");
  await page.goto("/admin/drivers?status=PENDING");
  const row = page.locator("tr", { hasText: email });
  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.getByText("APPROVED")).toBeVisible();
});
```

> **Implementer note:** the two "Mark delivered" / "View" link selectors in the happy path may need tightening to the real DOM (e.g. target the active-delivery card). Adjust during the green step; keep button texts ("Claim this order", "Mark delivered", "Approve") stable. The seed has exactly ONE READY order, so run order matters — `fullyParallel` is already `false` in `playwright.config.ts`, and each test reseeds is NOT automatic; see Step 2.

- [ ] **Step 2: Reseed and run headed (visible Chromium — user rule)**

Because the single READY order is consumed by a claim, **reseed before the run** and rely on the serial order (config has `fullyParallel: false`, `retries: 0`). The "already claimed" test claims the order; the happy-path test also claims+delivers it — so these two cannot both start from a fresh READY order in one pass. To keep the suite re-runnable, run:

```bash
pnpm db:seed
pnpm exec playwright test e2e/driver.spec.ts --headed --reporter=list
```

If the happy-path and already-claimed tests contend for the one READY order, split them: keep the happy path here, and reseed inside the already-claimed test via a tiny API or move it to its own run. **Simplest fix (do this):** add a second PAID READY order to the seed (Task 10) so there are two — one for each consuming test. Update Task 10 to also create a second READY order if `readyCount < 2`, mirroring the existing READY block.

- [ ] **Step 3: Full no-regression gate (headed)**

```bash
pnpm db:seed
pnpm test               # Vitest: claim contract + earnings math + state machine
pnpm build              # production build clean
pnpm exec playwright test --headed --reporter=list   # ALL specs
```
Expected: all green (the existing 65 + the new driver tests). Note: `e2e/role-isolation.spec.ts` already asserts the `/driver` guard passes for a driver — confirm it still holds now that `/driver` renders real UI.

- [ ] **Step 4: Commit**

```bash
git add e2e/driver.spec.ts
git commit -m "test(e2e): driver claim/deliver + already-claimed + pending-gate + admin approve (Phase 3)"
```

---

## Test cases doc (phase exit requirement)

Before Phase 3 is "done", write `docs/superpowers/test-cases/2026-06-13-phase-3-test-cases.md` (matrix across validation, business rules, permissions, error handling, route/API, data integrity) + an execution report, mirroring the Phase 1 docs. Cover explicitly: atomic claim (0-row path), driver-only delivery leg, approved-only claim, earnings math, cross-driver isolation. Commit separately:

```bash
git add docs/superpowers/test-cases/2026-06-13-phase-3-*.md
git commit -m "docs(test): Phase 3 test-case matrix + execution report"
```

---

## Self-Review

**1. Spec coverage (roadmap Phase 3):**
- Driver authz (`getDriver`, `requireApprovedDriver`) → Task 1. ✓
- Driver screens: awaiting/onboarding (Task 4), pickup pool + polled route (Task 5), order detail/claim (Task 7), active delivery (Tasks 7+8), earnings (Task 8), history (Task 8). ✓ *(profile screen D8 deferred — not required for the loop; noted as out of scope.)*
- Claim/deliver actions: atomic `updateMany` claim, 0-row ⇒ already-claimed + no event, interactive `$transaction`, defensive `assertTransition("DRIVER")`; `markDelivered` re-checks `driverId === me` → Tasks 2, 6. ✓
- Driver-scoped queries: `getMyDeliveries`, `getEarnings` (`_sum deliveryFeeCents`, DELIVERED only) → Task 3. ✓
- Admin driver management + KPIs → Task 9. ✓
- Exit acceptance (AC-3/7/8): admin approves PENDING driver; approved driver claims + delivers; earnings tally; second driver "already claimed"; PENDING driver cannot claim → Task 11 E2E. ✓

**2. Placeholder scan:** No TBD/TODO. The only "adjust to real DOM" notes are on E2E selectors, with the stable button texts called out. The seed second-READY-order fix is specified concretely.

**3. Type consistency:** `requireApprovedDriver()` returns `{ driver, userId }` (used in both actions). `assertClaimed(count)` matches `updateMany`'s `count`. `assertTransition(from, to, "DRIVER")` matches `lib/orders/state.ts`. `PoolOrder` shape is consistent across `getPool`, the route, and `PoolBoard`. `formatCents`/`orderRef` imported from the restaurant `_lib/format.ts` (not duplicated). `Badge` `value` prop matches usage.

**Risks flagged:** TOCTOU race → conditional `updateMany` (never read-then-write); status flip without audit row → interactive `$transaction`; approved-only gate enforced in the action (`requireApprovedDriver`), not just UI; the single seeded READY order is consumed by claiming tests → Task 10/11 add a second READY order so the suite is re-runnable; `READY ⇒ PAID` invariant lets the claim `where` stay scalar.

**Out of scope (correctly deferred):** driver online/offline toggle + driver profile editing (Phase 5 extras), admin reassign/force-cancel (Phase 5), real Stripe (Phase 4), the full customer→driver browser loop (verified after Phase 2 merges).
