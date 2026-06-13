# Admin Module

## 1. Purpose

Gives a platform administrator a cross-cutting control panel to monitor platform health (KPI overview), approve or suspend restaurants and drivers, browse all users, and intervene on orders (mark paid, force-cancel, reassign driver). The admin role bypasses the normal actor restrictions of the state machine and is the only role that can cancel an order at any non-terminal status.

---

## 2. Features

- **Overview dashboard** (`/admin`) — KPI stat cards: total restaurants, pending restaurant approvals, total orders, orders today, test revenue (sum of `totalCents` where payment is `PAID`), total drivers, pending driver approvals. Plus a table of the 10 most-recent orders.
- **Restaurants management** (`/admin/restaurants`) — lists all restaurants; filterable by status (`PENDING`, `APPROVED`, `SUSPENDED`). Per-row actions: **Approve** (→ `APPROVED`, visible to customers) and **Suspend** (→ `SUSPENDED`, hidden). A restaurant that is already in the target status does not show the redundant button.
- **Drivers management** (`/admin/drivers`) — lists all drivers with email, status; filterable by status. Per-row actions: **Approve** (→ `APPROVED`, can now claim from pool) and **Suspend** (→ `SUSPENDED`).
- **Users list** (`/admin/users`) — lists all users with name, email, and role. Filterable by email (case-insensitive `contains` search via GET form). Read-only; no user mutations.
- **Orders management** (`/admin/orders`) — lists all orders filterable by status (all eight enum values). Per-row actions:
  - **Mark paid** — appears when `payment.status = PENDING`; forces the payment to `PAID` (unblocks the restaurant queue for stuck orders).
  - **Force cancel** — appears on any non-terminal order; cancels regardless of current stage or actor; also nulls `driverId` to release the driver.
  - **Reassign** — appears when `status = OUT_FOR_DELIVERY`; a select of all APPROVED drivers + Reassign button swaps the `driverId`. Writes an audit `OrderStatusEvent` with `from = to = OUT_FOR_DELIVERY`.
  - **View** — opens an inline order detail panel above the table via `?id=` query param (items, totals, payment status, customer, restaurant, address).

---

## 3. User Flow

### Approve a restaurant

1. Admin signs in → lands on `/admin`.
2. Clicks **Restaurants** in the sidebar → `/admin/restaurants`.
3. Optionally filters by `PENDING`.
4. Clicks **Approve** on a row → `approveRestaurant` server action fires; page re-renders with status `APPROVED`.

### Suspend a restaurant

1. On the Restaurants page, clicks **Suspend** on an `APPROVED` or `PENDING` restaurant → status becomes `SUSPENDED`, hidden from customers.

### Approve a driver

1. Clicks **Drivers** → `/admin/drivers`; optionally filters by `PENDING`.
2. Clicks **Approve** → driver gains access to the pickup pool.

### Force-cancel an order

1. Clicks **Orders** → `/admin/orders`; optionally filters to a non-terminal status (e.g., `PLACED`).
2. Clicks **Force cancel** on a row → `forceCancelOrder` action:
   - Calls `assertTransition(from, "CANCELLED", "ADMIN")` — succeeds for any non-terminal status.
   - Wraps `order.update({ status: "CANCELLED", driverId: null })` and `orderStatusEvent.create` in a transaction.
3. Page re-renders; row now shows `CANCELLED`.

### Reassign a driver

1. On the Orders page, filters to `OUT_FOR_DELIVERY`.
2. Selects a new APPROVED driver from the dropdown beside the order row.
3. Clicks **Reassign** → `reassignDriver` action verifies the order is `OUT_FOR_DELIVERY`, updates `driverId`, and appends an audit event (`from = to = OUT_FOR_DELIVERY`).

### Mark an order paid manually

1. On the Orders page, finds an order with `PENDING` payment (e.g., webhook missed).
2. Clicks **Mark paid** → `adminMarkPaid` calls `markOrderPaid(id)` (same helper used by the Stripe webhook); order becomes visible to the restaurant queue.

---

## 4. Business Rules

- **Role re-verification in every action (second layer)** — every admin server action calls `assertAdmin()`, which reads `session.user.role` and throws "Forbidden: admin role required" if not `ADMIN`. The proxy already gates `/admin/**` to `ADMIN`, but the second check is defense-in-depth.
- **Admin can cancel any non-terminal order** — `assertTransition(from, "CANCELLED", "ADMIN")` succeeds for `PLACED`, `ACCEPTED`, `PREPARING`, `READY`, `OUT_FOR_DELIVERY`. It throws `IllegalTransitionError` for `DELIVERED`, `REJECTED`, `CANCELLED` (already terminal — graph illegality beats actor).
- **Admin allowed on every legal state-machine edge** — the `TRANSITION_ACTORS` map includes `ADMIN` on all edges, allowing the admin to fire any transition including the kitchen and delivery legs.
- **Reassign is not a status change** — `reassignDriver` only swaps `driverId`; `status` stays `OUT_FOR_DELIVERY`. The audit event uses `from = to = OUT_FOR_DELIVERY` as a signal that a driver swap occurred, not a transition.
- **Reassign only to APPROVED drivers** — `reassignDriver` verifies `driver.status === "APPROVED"` before writing; throws "Driver not found or not APPROVED" otherwise.
- **Force cancel nulls driverId** — when cancelling an `OUT_FOR_DELIVERY` order, the driver reference is cleared so the driver is not stuck with a phantom active delivery.
- **Mark paid is idempotent** — `markOrderPaid` uses `updateMany({ where: { orderId, status: "PENDING" } })`; a second call changes 0 rows.
- **Approval status is admin-only** — neither `restaurant/profile/actions.ts` nor any customer or driver action touches `Restaurant.status` or `Driver.status`; those fields are mutated only from this module.
- **APPROVED-only visibility downstream** — approving a restaurant makes it appear in customer browse; approving a driver lets them claim from the pool. These effects flow from the business rules of the other modules, not from direct admin writes to those views.

---

## 5. Technical Implementation

### Pages and components

| File | Role |
|---|---|
| `app/(admin)/admin/page.tsx` | Server Component; parallel Prisma queries for all KPI data; recent-orders table |
| `app/(admin)/admin/restaurants/page.tsx` | Server Component; filterable restaurant list; approve/suspend forms |
| `app/(admin)/admin/drivers/page.tsx` | Server Component; filterable driver list; approve/suspend forms |
| `app/(admin)/admin/users/page.tsx` | Server Component; user list with email search (GET form) |
| `app/(admin)/admin/orders/page.tsx` | Server Component; filterable order list; inline detail panel via `?id=`; per-row action forms |
| `app/(admin)/admin/layout.tsx` | Admin shell layout wrapping all admin pages |
| `app/(admin)/_components/admin-nav.tsx` | Sidebar navigation |
| `app/(admin)/_components/badge.tsx` | Raw-enum badge (renders the enum value string as-is) |
| `app/(admin)/_components/filter-bar.tsx` | Reusable status filter chip bar (GET links) |
| `app/(admin)/_components/stat-card.tsx` | KPI card with label, value, and icon |
| `app/(admin)/_components/table.tsx` | Reusable table primitives (`Table`, `THead`, `TBody`, `TR`, `TH`, `TD`) |
| `app/(admin)/_components/money.ts` | `formatCents` — same logic as restaurant/customer area (deferred consolidation) |

### Server Actions

| File | Exported actions |
|---|---|
| `app/(admin)/admin/restaurants/actions.ts` | `approveRestaurant`, `suspendRestaurant` — each calls `assertAdmin()` then `prisma.restaurant.update` |
| `app/(admin)/admin/drivers/actions.ts` | `approveDriver`, `suspendDriver` — mirrors restaurants actions |
| `app/(admin)/admin/orders/actions.ts` | `adminMarkPaid`, `forceCancelOrder`, `reassignDriver` |

### Ownership / authorization enforcement

1. `proxy.ts` (route guard): allows only `ADMIN` role into `/admin/**`.
2. `assertAdmin()` in every server action: re-reads `session.user.role`; throws if not `ADMIN`.
3. No data-scoping needed (admin has global read/write); instead the actions scope to the specific record by ID, and the state machine prevents illegal transitions even for ADMIN.

### Key data queries

- **Overview KPIs**: seven parallel `Promise.all` calls — `prisma.restaurant.count`, `prisma.driver.count`, `prisma.order.count`, `prisma.order.aggregate._sum.totalCents` (PAID), `prisma.order.findMany` (last 10).
- **Restaurants / Drivers / Users**: `findMany` with optional `where: { status: filter }`; parsed from query param via enum guard.
- **Orders**: `findMany` with optional status filter + `include: { restaurant, customer, payment }`. The `OrderDetail` async server component fetches a single order by `id` when `?id=` is present.
- **Reassign**: `prisma.order.updateMany({ where: { id, status: "OUT_FOR_DELIVERY" } })` — scoped so a wrong-status or unknown ID is a safe no-op (result.count === 0 throws a user-visible error).

---

## 6. Dependencies

- **State machine** (`lib/orders/state.ts`) — `assertTransition(from, "CANCELLED", "ADMIN")` in `forceCancelOrder`; `isTerminal` used in the orders page to decide whether to show the Force cancel button.
- **Payment helper** (`lib/orders/payment.ts`) — `markOrderPaid` in `adminMarkPaid`.
- **Prisma** (`lib/db.ts`) — models used: `Restaurant`, `Driver`, `User`, `Order`, `OrderItem`, `Payment`, `OrderStatusEvent`.
- **Auth** (`lib/auth.ts`) — `auth()` in `assertAdmin`.
- **shadcn/ui** — `Card`, `Button`, `Input`, `Badge` (shadcn), `StatusChip`.
- **lucide-react** — icons in KPI cards and order detail (`Store`, `Clock`, `ReceiptText`, `Car`, `DollarSign`, `TrendingUp`, `User`, `MapPin`, `CreditCard`).

---

## 7. Test Coverage

### E2E tests (`e2e/admin.spec.ts`)

| Test | What it covers |
|---|---|
| `admin can suspend then approve a restaurant` | Suspend → SUSPENDED badge; Approve → APPROVED badge |
| `admin overview shows platform KPI cards` | "Total orders" and "Pending approvals" labels visible |
| `admin orders page filters to READY status` | FilterBar READY link → `?status=READY`; READY badge visible |
| `admin orders page handles bogus status filter without crashing` | Unknown `?status=NONSENSE` → page renders without error; table has rows |
| `admin can force-cancel a PLACED order` | Force cancel changes first PLACED row to CANCELLED |

### Driver-approval E2E (`e2e/driver.spec.ts`)

| Test | What it covers |
|---|---|
| `admin approves a pending driver` | Admin visits `/admin/drivers?status=PENDING`, clicks Approve, driver moves to APPROVED filter |

### Role-isolation E2E (`e2e/role-isolation.spec.ts`)

- `unauthenticated: protected routes redirect to /signin` — `/admin` among the protected paths.
- `customer: cannot reach /admin, /restaurant, or /driver` — customer bounced from `/admin`.
- `restaurant: cannot reach /admin or /driver` — restaurant owner bounced from `/admin`.
- `driver: cannot reach /admin or /restaurant; /driver guard passes` — driver bounced from `/admin`.

### State machine unit tests (`lib/orders/state.test.ts`)

- `admin CAN force-cancel from any non-terminal status` — all five non-terminal statuses asserted.
- `admin CANNOT cancel an already-terminal order (graph illegal)` — DELIVERED, REJECTED, CANCELLED all throw `IllegalTransitionError`.
- `admin is allowed on every legal edge (kitchen + delivery legs)` — all 11 legal edges pass with ADMIN actor.
- `graph illegality beats actor: even admin cannot make an illegal jump` — `PLACED → DELIVERED` throws even for ADMIN.

### What is NOT covered by these tests

- Users screen (explicitly noted as "NOT covered" in the spec file).
- Revenue/payment math accuracy in the KPI overview.
- Paginated orders or long lists.
- Reassign-driver UI (spec notes: "not covered here because it requires a known OUT_FOR_DELIVERY order in a deterministic state").
- Force-cancelling from `ACCEPTED`, `PREPARING`, `READY`, `OUT_FOR_DELIVERY` via E2E (state-machine actor coverage for those edges is in Vitest only).
- Suspending a driver (only approve is tested via E2E; state machine unit tests cover the graph).
- Admin marking an order paid via the UI (the `adminMarkPaid` action path is not covered by a dedicated E2E test).
