# Driver Module

## 1. Purpose

Lets an admin-approved driver go online, see the shared pool of unclaimed `READY` orders, claim one atomically (first-come-first-served), mark it delivered, and view their earnings. The driver owns the last two transitions of the order state machine: `READY → OUT_FOR_DELIVERY` (claim) and `OUT_FOR_DELIVERY → DELIVERED`.

---

## 2. Features

- **Driver home** (`/driver`) — entry point after sign-in. An `APPROVED` driver is immediately redirected to `/driver/pool`. A `PENDING` or `SUSPENDED` driver sees an awaiting-approval card explaining their status.
- **Online/offline toggle** — a pill button in the driver shell header. Calls `setDriverOnline` server action. A driver must be online to claim an order; an offline driver visiting an order detail sees a "Go online to claim this order" note instead of the Claim button.
- **Pickup pool** (`/driver/pool`) — lists all unclaimed, `PAID`, `READY` orders (shared across all drivers), oldest-first. Refreshes via SWR polling against the pool API route every 5 s.
- **Order detail** (`/driver/order/[id]`) — shows the pickup/drop route card with restaurant name, customer address, delivery fee earned, and item list. Displays the appropriate action:
  - **Claim this order** — available if `status = READY`, `driverId = null`, `payment = PAID`, and the driver is online.
  - **Mark delivered** — available if `status = OUT_FOR_DELIVERY` AND `driverId = this driver`.
  - "This order isn't available to you." — shown for any other state (already claimed by someone else, or delivered).
- **My deliveries** (`/driver/deliveries`) — two sections: Active (status `OUT_FOR_DELIVERY`) and Past (status `DELIVERED`), scoped to this driver.
- **Earnings** (`/driver/earnings`) — total earned (sum of `deliveryFeeCents` on `DELIVERED` orders), delivery count, and average per delivery. Display only; no payout integration.

---

## 3. User Flow

### Happy path (claim → deliver → earn)

1. Driver signs in; is redirected to `/driver/pool` (approved).
2. Goes online via the toggle pill (required to claim).
3. Sees a pool card for a `READY` order; clicks **View & claim** → `/driver/order/[id]`.
4. Reviews pickup restaurant, drop address, and delivery fee.
5. Clicks **Claim this order** → the atomic `claimOrder` server action:
   - `updateMany` with `where: { id, status: "READY", driverId: null }` — changes 0 rows if someone beat them; throws `AlreadyClaimedError` and rolls back the transaction.
   - Changes 1 row if this driver won: sets `status = OUT_FOR_DELIVERY`, `driverId = driver.id`.
   - Appends an `OrderStatusEvent` in the same transaction.
6. Redirected to `/driver/deliveries`; the order appears under Active with status `OUT_FOR_DELIVERY`.
7. Clicks the active delivery card → `/driver/order/[id]`; clicks **Mark delivered**.
8. Order becomes `DELIVERED`; appears under Past on `/driver/deliveries`.
9. `/driver/earnings` shows updated total including this delivery fee.

### Race condition (already claimed)

- If between viewing the order detail and clicking Claim, another driver claims the same order, `claimOrder` gets 0 rows back, throws `AlreadyClaimedError`, rolls back, and the client action surfaces an error. The driver is not assigned.

### Pending/Suspended driver

1. Driver signs in; lands on `/driver`.
2. Sees a card with their status (`PENDING` / `SUSPENDED`) and a message: "Your application is awaiting admin approval."
3. `/driver/pool` redirects back to `/driver` if `driver.status !== "APPROVED"`.

---

## 4. Business Rules

- **APPROVED-only claim** — `requireApprovedDriver()` checks `driver.status === "APPROVED"` before any `claimOrder` or `markDelivered` call. A `PENDING` or `SUSPENDED` driver gets an error.
- **Online-only claim** — `claimOrder` checks `driver.isOnline`; throws "You must be online to claim orders" if not. The UI also hides the Claim button and shows a note when `isOfflineBlocked = isClaimable && !driver.isOnline`.
- **Atomic first-come claim** — `updateMany` with `where: { status: "READY", driverId: null }` is the race-condition guard. If it updates 0 rows, `assertClaimed(count)` throws `AlreadyClaimedError` and the surrounding `$transaction` rolls back the event too.
- **Driver-only delivery leg** — `assertTransition(status, "DELIVERED", "DRIVER")` in `markDelivered` blocks delivery if the order is not `OUT_FOR_DELIVERY`, or if called with any other actor. `assertTransition(status, "OUT_FOR_DELIVERY", "DRIVER")` is similarly encoded via the state machine for the claim transition.
- **Ownership on deliver** — `markDelivered` queries `prisma.order.findFirst({ where: { id, driverId: driver.id } })`; a foreign or unclaimed order ID matches zero rows.
- **Pool visibility** — only `status: "READY"`, `driverId: null`, `payment: { status: "PAID" }` orders appear in the pool. An order claimed by another driver disappears from the pool.
- **Earnings = delivery fees only** — `getEarnings` aggregates `deliveryFeeCents` over `DELIVERED` orders for this driver. No payouts; display only.
- **Atomic status + event** — `claimOrder` and `markDelivered` both wrap the `order.update/updateMany` and `orderStatusEvent.create` in `prisma.$transaction`.

---

## 5. Technical Implementation

### Pages and components

| File | Role |
|---|---|
| `app/(driver)/driver/page.tsx` | Server Component; redirects APPROVED to pool; shows awaiting-approval card otherwise |
| `app/(driver)/driver/pool/page.tsx` | Server Component; loads initial pool; passes to `PoolBoard`; redirects non-approved |
| `app/(driver)/driver/order/[id]/page.tsx` | Server Component; shows order detail with status-conditional action buttons |
| `app/(driver)/driver/deliveries/page.tsx` | Server Component; splits driver's orders into active/past |
| `app/(driver)/driver/earnings/page.tsx` | Server Component; shows total earned, count, and average |
| `app/(driver)/_components/pool-board.tsx` | Client Component; SWR polls `/driver/pool/api` every 5 s |
| `app/(driver)/_components/online-toggle.tsx` | Client Component; calls `setDriverOnline` via `useTransition` |
| `app/(driver)/_components/driver-shell.tsx` | Layout shell; renders online-toggle pill in header |
| `app/(driver)/_components/driver-nav.tsx` | Sidebar navigation |
| `app/(driver)/driver/order/[id]/_components/claim-button.tsx` | Client Component; calls `claimOrder` action |
| `app/(driver)/driver/order/[id]/_components/deliver-button.tsx` | Client Component; calls `markDelivered` action |

### Server Actions

| File | Exported actions |
|---|---|
| `app/(driver)/_lib/actions.ts` | `setDriverOnline(online: boolean)` — requires APPROVED driver; updates `isOnline` |
| `app/(driver)/driver/order/[id]/actions.ts` | `claimOrder(orderId)` — atomic updateMany + event in one transaction; `markDelivered(orderId)` — ownership-scoped deliver |

### Route Handler (SWR endpoint)

| File | Route | Purpose |
|---|---|---|
| `app/(driver)/driver/pool/api/route.ts` | `GET /driver/pool/api` | Returns `{ ok, data: PoolOrder[], error }`; checks APPROVED status server-side |

### Lib helpers

| File | Purpose |
|---|---|
| `app/(driver)/_lib/driver.ts` | `getDriver` / `requireApprovedDriver` — second authz layer |
| `app/(driver)/_lib/deliveries.ts` | `getPool`, `getMyDeliveries`, `getEarnings`, `sumDeliveredFees` (pure) |
| `lib/orders/claim.ts` | `AlreadyClaimedError`, `assertClaimed(count)` — atomic claim contract |

### Ownership enforcement

1. `proxy.ts` (route guard): allows `DRIVER` role into `/driver/**`.
2. `requireApprovedDriver()` in every mutation action — checks `driver.status === "APPROVED"` after resolving by `userId`.
3. `claimOrder` — `updateMany` conditioned on `status: "READY", driverId: null` prevents double-claim.
4. `markDelivered` — `findFirst({ where: { id, driverId: driver.id } })` prevents delivering someone else's claimed order.
5. Pool and deliveries queries filter by `driverId = driver.id`; a foreign driver cannot see another driver's deliveries.

---

## 6. Dependencies

- **State machine** (`lib/orders/state.ts`) — `assertTransition` used in `markDelivered`; actor `DRIVER` is the only one allowed on the delivery legs.
- **Atomic claim contract** (`lib/orders/claim.ts`) — `assertClaimed` and `AlreadyClaimedError`.
- **Prisma** (`lib/db.ts`) — models used: `Driver`, `Order`, `OrderItem`, `Payment`, `OrderStatusEvent`.
- **Auth** (`lib/auth.ts`) — `auth()` in `getDriver` / `requireApprovedDriver`.
- **SWR** (`swr`) — `PoolBoard` polls every 5 s; stops when pool is empty or driver is offline.
- **shadcn/ui** — `Card`, `Button`, `Badge` (admin badge component re-used), `ImageFrame`, `EmptyState`.
- **Restaurant format helpers** (`app/(restaurant)/_lib/format.ts`) — `formatCents`, `orderRef` re-used in driver pages (noted as deferred cleanup in that file).

---

## 7. Test Coverage

### Unit tests

| File | What it covers |
|---|---|
| `app/(driver)/_lib/deliveries.test.ts` | `sumDeliveredFees`: sums only DELIVERED; zero for empty/no-delivered; integer result |
| `lib/orders/claim.test.ts` | `assertClaimed(1)` does not throw; `assertClaimed(0)` throws `AlreadyClaimedError`; `assertClaimed(-1)` throws |

### E2E tests (`e2e/driver.spec.ts`)

| Test | What it covers |
|---|---|
| `approved driver claims a READY order, delivers it, and earns the fee` | Happy path: pool → claim → OUT_FOR_DELIVERY → mark delivered → earnings show $2.99 |
| `second driver cannot claim an already-claimed order` | Race: driver 2 sees "This order isn't available to you." after driver 1 claimed |
| `a pending driver is kept out of the pool` | Pending driver sees awaiting-approval screen; direct `/driver/pool` redirects to `/driver` |
| `admin approves a pending driver` | Admin approves driver in `/admin/drivers?status=PENDING`; driver moves to APPROVED filter |

### Offline-driver gate (`e2e/phase5b-gating.spec.ts`)

| Test | What it covers |
|---|---|
| `driver goes offline; Claim button hidden; driver goes online; Claim button shown` | Online toggle controls claim availability end-to-end |

### State machine unit tests (`lib/orders/state.test.ts`)

- `driver may perform the delivery legs but not the kitchen legs` — DRIVER allowed on `READY → OUT_FOR_DELIVERY` and `OUT_FOR_DELIVERY → DELIVERED`; throws `UnauthorizedActorError` for `PREPARING → READY`.
- `driver CANNOT force-cancel` — `READY → CANCELLED` and `OUT_FOR_DELIVERY → CANCELLED` throw for DRIVER actor.

### What is NOT covered by these tests

- True concurrent racing (two simultaneous `claimOrder` calls); the test simulates it deterministically by claiming then revisiting the same order.
- Online/offline toggle for a PENDING driver (they cannot reach the pool to test the toggle).
- `isOnline = false` blocking at the server action level (tested at UI level only; the action check is covered by reading the code, not by an automated test).
- Driver earnings with multiple delivered orders (only a single $2.99 delivery is tested).
- Pool SWR refresh observable in the browser after a restaurant marks an order READY.
