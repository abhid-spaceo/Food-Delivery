# Restaurant Module

## 1. Purpose

Gives a restaurant owner a dashboard to manage their incoming order queue, advance orders through the kitchen stages (up to `READY`), manage their menu, and control their profile and open/closed status. The restaurant drives every kitchen leg; the delivery leg belongs exclusively to the driver.

---

## 2. Features

- **Orders queue board** (`/restaurant`) — a SWR-polled kanban-style board with four columns: New (paid `PLACED` orders), In-progress (`ACCEPTED` + `PREPARING` + `OUT_FOR_DELIVERY`), Ready (awaiting driver), Completed (`DELIVERED`, `REJECTED`, `CANCELLED`). Only PAID orders appear.
- **Order detail page** (`/restaurant/orders/[id]`) — shows customer info, address, payment status, item breakdown with totals, a status timeline, and action buttons that are context-sensitive to the current order status.
- **Status actions** — Accept (with optional prep-time entry), Reject, Start preparing, Mark ready. The restaurant cannot advance beyond `READY`; the "delivery leg" buttons (`OUT_FOR_DELIVERY`, `DELIVERED`) are reserved for the driver and do not appear for the restaurant.
- **Menu manager** (`/restaurant/menu`) — full CRUD for categories (create, rename, delete) and items (create, edit, delete, toggle availability). Category delete cascades to its items. Prices validated as integer cents.
- **Profile page** (`/restaurant/profile`) — edit name, cuisine, hours, delivery area. Toggle open/closed (`isAcceptingOrders`). Approval status is read-only (only an admin can change it).

---

## 3. User Flow

### Fulfillment path (New → Ready)

1. Restaurant owner signs in and lands on `/restaurant` (the queue board).
2. Sees a paid `PLACED` order in the **New** column; clicks **Open** to go to the order detail.
3. Reviews items, customer, and address. Optionally enters a prep time.
4. Clicks **Accept** → order moves to `ACCEPTED`. The board polls and moves it to In-progress.
5. Clicks **Start preparing** → order moves to `PREPARING`.
6. Clicks **Mark ready** → order moves to `READY`. Board moves it to the Ready column.
7. No further actions appear ("No further actions for this order.") — from here a driver claims it.

### Reject path

1. On a `PLACED` order detail, click **Reject** → order moves to `REJECTED` (terminal). No further actions.

### Menu management

1. Navigate to `/restaurant/menu`.
2. Type a category name and click **+ Category** to create one.
3. Within a category, click **+ Item** to open the item form dialog (name, description, price, veg flag, availability).
4. Toggle availability inline (Available/Unavailable button per row).
5. Click **Edit** to open the form dialog pre-filled.
6. Click **Delete** on a category or item to remove it (category deletes cascade).

### Profile management

1. Navigate to `/restaurant/profile`.
2. Click **Close store** to set `isAcceptingOrders = false` (customers see "Currently not accepting orders", no Add buttons).
3. Click **Open store** to re-enable ordering.
4. Update name, cuisine, hours, or delivery area and click **Save changes**.

---

## 4. Business Rules

- **Payment gates the queue** — `getQueue` filters `payment: { status: "PAID" }`; unpaid `PLACED` orders are invisible to the restaurant.
- **Ownership scope (second layer)** — every page and action calls `requireOwnedRestaurant()` or `getOwnedRestaurant()`, which resolves the restaurant via `ownerId = session.user.id`. A foreign order ID matched against `restaurantId: restaurant.id` returns 404.
- **Restaurant drives only the kitchen leg** — `assertTransition(from, to, "RESTAURANT")` blocks any attempt to fire `READY → OUT_FOR_DELIVERY` or `OUT_FOR_DELIVERY → DELIVERED`; those edges allow only `DRIVER` and `ADMIN`. An `UnauthorizedActorError` is thrown.
- **Price is integer cents** — `itemSchema` in `menu/actions.ts` validates `priceCents` as `z.coerce.number().int().min(0).max(1_000_000)`. Edits to a live menu item do not retroactively change snapshotted `OrderItem` rows.
- **Open/closed gating** — `isAcceptingOrders = false` blocks `placeOrder` at the server-action level (checked server-side, not just in the UI).
- **Approval is admin-only** — `updateProfile` never touches `status`; only `/admin/restaurants/actions.ts` may change it.
- **Cross-tenant isolation** — `prisma.order.findFirst({ where: { id, restaurantId: restaurant.id } })` means a foreign order ID matches zero rows and triggers `notFound()`.
- **Atomic status + event** — every `advanceOrder` call wraps the `order.update` and `orderStatusEvent.create` in a single `prisma.$transaction`.
- **Zod validation at the boundary** — all form data in both order actions and menu actions is parsed through Zod schemas before any DB write.

---

## 5. Technical Implementation

### Pages and components

| File | Role |
|---|---|
| `app/(restaurant)/restaurant/page.tsx` | Server Component; loads initial queue data and passes it to `QueueBoard` |
| `app/(restaurant)/restaurant/orders/[id]/page.tsx` | Server Component; scopes query to owned restaurant; builds timeline steps |
| `app/(restaurant)/restaurant/menu/page.tsx` | Server Component; lists categories + items for the owned restaurant |
| `app/(restaurant)/restaurant/profile/page.tsx` | Server Component; loads the owned restaurant record |
| `app/(restaurant)/_components/queue-board.tsx` | Client Component; receives initial data; SWR polls `/restaurant/orders/queue` every 5 s |
| `app/(restaurant)/_components/order-actions.tsx` | Client Component; renders action buttons matching the current order status |
| `app/(restaurant)/_components/item-form-dialog.tsx` | Client Component; dialog for create/edit menu item |
| `app/(restaurant)/_components/status-badge.tsx` | Status display chip |
| `app/(restaurant)/_components/dashboard-shell.tsx` | Layout shell wrapping all restaurant pages |
| `app/(restaurant)/_components/restaurant-nav.tsx` | Sidebar navigation |

### Server Actions

| File | Exported actions |
|---|---|
| `app/(restaurant)/restaurant/orders/[id]/actions.ts` | `acceptOrder`, `rejectOrder`, `startPreparing`, `markReady` — all call internal `advanceOrder` which runs `requireOwnedRestaurant` + `assertTransition` + atomic transaction |
| `app/(restaurant)/restaurant/menu/actions.ts` | `createCategory`, `renameCategory`, `deleteCategory`, `createItem`, `updateItem`, `deleteItem`, `toggleItemAvailability` — each resolves the owned restaurant then scopes writes via `restaurantId` |
| `app/(restaurant)/restaurant/profile/actions.ts` | `updateProfile`, `toggleAcceptingOrders` — each resolves the owned restaurant before writing |

### Route Handler (SWR endpoint)

| File | Route | Purpose |
|---|---|---|
| `app/(restaurant)/restaurant/orders/queue/route.ts` | `GET /restaurant/orders/queue` | Returns `{ ok, data: QueueData, error }` used by the queue board's SWR poll |

### Lib helpers

| File | Purpose |
|---|---|
| `app/(restaurant)/_lib/restaurant.ts` | `getOwnedRestaurant` / `requireOwnedRestaurant` — second authz layer; resolves restaurant by `ownerId` |
| `app/(restaurant)/_lib/queue.ts` | `getQueue(restaurantId)` — shared query for both the page and the JSON route; enforces payment gate |
| `app/(restaurant)/_lib/format.ts` | `formatCents`, `statusLabel`, `actionLabel`, `orderRef` |

### Ownership enforcement

1. `proxy.ts` (route guard): allows `RESTAURANT` role into `/restaurant/**`.
2. `requireOwnedRestaurant()` / `getOwnedRestaurant()` in every action and page — resolves restaurant via `ownerId = session.user.id`; all subsequent Prisma writes add `restaurantId: restaurant.id` to their `where` clause.
3. `assertTransition(from, to, "RESTAURANT")` prevents any attempt to fire driver-only delivery transitions.

---

## 6. Dependencies

- **State machine** (`lib/orders/state.ts`) — `assertTransition` used in every order-advance action.
- **Prisma** (`lib/db.ts`) — models used: `Restaurant`, `MenuCategory`, `MenuItem`, `Order`, `OrderItem`, `Payment`, `OrderStatusEvent`.
- **Auth** (`lib/auth.ts`) — `auth()` called inside `requireOwnedRestaurant` / `getOwnedRestaurant`.
- **SWR** (`swr`) — `QueueBoard` polls `/restaurant/orders/queue` every 5 s.
- **Zod** — input validation in menu and profile actions.
- **shadcn/ui** — `Card`, `Button`, `Input`, `Label`, `Badge`, `StatusChip`, `Timeline`, `ImageFrame`, `VegIndicator`.

---

## 7. Test Coverage

### E2E tests (`e2e/restaurant-fulfillment.spec.ts`)

| Test | What it covers |
|---|---|
| `owner advances a paid order accept -> prepare -> ready` | Full kitchen path; confirms "No further actions" at READY |
| `owner can reject a placed order` | Reject path; terminal state |
| `payment gate: unpaid order is not visible in the queue` | Sentinel $77.77 order absent from all queue columns |
| `queue board shows New and Ready columns and correct item count` | Column labels; item count "2 items" from Margherita ×2 seed |
| `order detail shows correct subtotal, fee, and total` | Money math: $18.00 + $2.99 = $20.99 |
| `non-existent order id does not render order detail` | 404 for unknown ID (no "Back to queue" link present) |
| `cross-tenant: mario's owner cannot view spice hub order` | Owner 1 cannot see Owner 2's order (foreign `restaurantId` → 404) |

### Role-isolation test (`e2e/role-isolation.spec.ts`)

- `restaurant: cannot reach /admin or /driver` — proxy bounces restaurant role from wrong routes.

### State machine unit tests (`lib/orders/state.test.ts`)

- Covers restaurant-specific actor restrictions: restaurant may fire `PREPARING → READY` but not `READY → OUT_FOR_DELIVERY`; `UnauthorizedActorError` thrown for delivery legs.
- Covers restaurant cannot force-cancel from `ACCEPTED`, `PREPARING`, `READY`.

### Closed-store gate (`e2e/phase5b-gating.spec.ts`)

- `owner closes store; customer cannot place order; owner reopens; order goes through` — tests the `isAcceptingOrders` toggle end-to-end.

### What is NOT covered by these tests

- Menu and profile CRUD via E2E (explicitly noted in the spec file: "NOT covered: menu/profile CRUD").
- Renaming a category (action exists, no test).
- Concurrent queue updates / SWR refresh visible in a second browser window.
- `sortOrder` field on `MenuCategory` (stored but not tested).
- Orders with more than one customer or multi-item orders beyond Margherita ×2.
