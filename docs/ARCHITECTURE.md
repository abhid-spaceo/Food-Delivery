# QwikBite — Architecture Reference

> Branch: `Abhi/qwikbite`
> Last updated: 2026-06-14
> Grounded in the actual code on this branch. Aspirational items are explicitly marked.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Database Design](#3-database-design)
4. [APIs — Route Handlers and Server Actions](#4-apis)
5. [End-to-End Workflows](#5-end-to-end-workflows)
6. [Permissions Matrix](#6-permissions-matrix)
7. [Environment Setup](#7-environment-setup)
8. [Deployment](#8-deployment)
9. [Testing](#9-testing)
10. [Known Limitations](#10-known-limitations)
11. [Future Enhancements](#11-future-enhancements)

---

## 1. Project Overview

QwikBite is a four-sided food-delivery marketplace. It has four distinct roles operating inside one web application:

- **Customer** — discovers restaurants, builds a cart, pays, and tracks their order.
- **Restaurant** — receives paid orders, manages the kitchen workflow from acceptance through to ready-for-pickup, and edits their menu and profile.
- **Driver** — claims ready orders from a shared pool and delivers them, earning the delivery fee.
- **Admin** — approves or suspends restaurants and drivers, and can force-cancel or reassign any in-flight order.

### Delivery model

Delivery is deliberately lightweight. A restaurant moves an order through the kitchen and marks it `READY`. That order then enters a shared pool visible to every approved, online driver. The first driver to press "Claim" wins it atomically. There is no GPS tracking, no auto-dispatch, no surge pricing, and no service zones. Drivers self-onboard; an admin approves them before they can claim anything.

### Tech stack

| Layer | Choice | Version |
|---|---|---|
| Language | TypeScript | 5.x |
| Framework | Next.js (App Router) | 16.2.9 |
| UI library | React | 19.2.4 |
| Styling | Tailwind CSS v4 + shadcn/ui | 4.x |
| ORM | Prisma 7 with `@prisma/adapter-pg` | 7.8.0 |
| Database | PostgreSQL | any recent |
| Auth | Auth.js (NextAuth) v5 beta | 5.0.0-beta.31 |
| Payments | Stripe (test mode only) | 22.2.0 |
| Real-time updates | SWR polling (no websockets) | 2.4.1 |
| Schema validation | Zod | 4.4.3 |
| Unit tests | Vitest | 4.1.8 |
| E2E tests | Playwright | 1.60.0 |
| Deploy | Vercel + Vercel Postgres / Neon | — |

---

## 2. Architecture

### One app, four role-scoped route groups

This is a single Next.js application with one database and one Auth.js config. All four roles live in the same codebase inside Next.js "route groups" (parenthesized directory names that do not appear in URLs):

```
app/
  (admin)/          → /admin/**
  (auth)/           → /signin, /signup
  (customer)/       → /browse, /cart, /checkout, /orders/**, /restaurants/**
  (driver)/         → /driver/**
  (marketing)/      → /  (landing page)
  (restaurant)/     → /restaurant/**
  api/
    stripe/
      webhook/      → POST /api/stripe/webhook
```

There is no `src/` directory. Route groups enforce code organization; the actual URL guards are in `proxy.ts`.

### Route protection: `proxy.ts` (first authorization layer)

`proxy.ts` is the Next.js 16 replacement for `middleware.ts`. It runs Auth.js's `authorized` callback at the edge on every request (except Next.js internals, static files, and API routes). The guard is role-only:

- `/admin` or `/admin/**` — requires role `ADMIN`
- `/restaurant` or `/restaurant/**` — requires role `RESTAURANT`
- `/driver` or `/driver/**` — requires role `DRIVER`
- `/account`, `/cart`, `/checkout`, `/orders` — requires any logged-in user
- Everything else (browse, restaurants detail, landing page) — public

Sources: `proxy.ts`, `auth.config.ts`.

**The route guard is not enough on its own.** It only proves the user has the right role. It does not prove they own the data they are requesting. Every Server Action and polled Route Handler independently re-verifies ownership (see Section 6).

### Mutations: Server Actions only

All data mutations (placing orders, advancing order status, managing menus, admin approval, driver claim/deliver) are implemented as Next.js Server Actions marked `"use server"`. Each one ends with `revalidatePath(...)` to trigger a server re-render of affected pages.

Route Handlers (`route.ts`) are the exception and are only used for:
1. The Stripe webhook — `POST /api/stripe/webhook`
2. SWR-polled JSON endpoints (restaurant queue, driver pool, customer order status)

### Server Components for reads

Pages that only display data are React Server Components. They fetch directly from the database via the Prisma singleton. Client components are used only where interaction is needed (cart context, polling hooks, form state).

### Cart state

The cart lives in React context backed by `localStorage`. It is never stored in the database until checkout. The server at checkout only trusts the item IDs and quantities submitted — it re-reads names and prices from the database to prevent price manipulation. Source: `app/(customer)/_lib/cart.ts`, `app/(customer)/checkout/actions.ts`.

### SWR polling, not push

Status changes are surfaced by periodic SWR polling — no WebSockets, no Server-Sent Events. Three endpoints are polled:

| Endpoint | Poller | Reason |
|---|---|---|
| `GET /restaurant/orders/queue` | Restaurant queue board | Order status changes |
| `GET /driver/pool/api` | Driver pool board | New READY orders appear |
| `GET /orders/[id]/status` | Customer tracking page | Order progresses |

### Order state machine (single source of truth)

All order status transitions are validated in `lib/orders/state.ts`. No Server Action may advance an order status without calling `assertTransition(from, to, actor)`. Illegal jumps (e.g. `PLACED → DELIVERED`) throw `IllegalTransitionError`; the right actor calling the right edge is enforced by `UnauthorizedActorError`.

#### State graph

```
                   ┌─ REJECTED (terminal)
PLACED ────────────┤
  │                └─ CANCELLED* (customer or admin)
  │
  └→ ACCEPTED ────────────────────────────────┐
       │                                      │ CANCELLED* (admin only)
       └→ PREPARING ─────────────────────────┤
              │                              │ CANCELLED* (admin only)
              └→ READY ─────────────────────┤
                    │                        │ CANCELLED* (admin only)
                    └→ OUT_FOR_DELIVERY ─────┤
                           │                 │ CANCELLED* (admin only)
                           └→ DELIVERED (terminal)
```

`*` CANCELLED is terminal once reached.

#### Actor map (who fires each edge)

| Transition | Allowed actors |
|---|---|
| `PLACED → ACCEPTED` | RESTAURANT, ADMIN |
| `PLACED → REJECTED` | RESTAURANT, ADMIN |
| `PLACED → CANCELLED` | CUSTOMER, ADMIN |
| `ACCEPTED → PREPARING` | RESTAURANT, ADMIN |
| `ACCEPTED → CANCELLED` | ADMIN only |
| `PREPARING → READY` | RESTAURANT, ADMIN |
| `PREPARING → CANCELLED` | ADMIN only |
| `READY → OUT_FOR_DELIVERY` | DRIVER, ADMIN (driver claim) |
| `READY → CANCELLED` | ADMIN only |
| `OUT_FOR_DELIVERY → DELIVERED` | DRIVER, ADMIN |
| `OUT_FOR_DELIVERY → CANCELLED` | ADMIN only |

Key rules derived from this table:

- A restaurant may never mark DELIVERED (the driver leg is driver-only).
- A customer may only cancel before the restaurant accepts (i.e. only from `PLACED`).
- Only ADMIN can force-cancel once a restaurant has accepted.
- Even ADMIN cannot make a graph-illegal jump (e.g. `PLACED → DELIVERED`).

Every transition appends an `OrderStatusEvent` row to the database with `from`, `to`, and `byUserId`. This is the audit trail and the customer's tracking timeline.

### Payment gates the restaurant queue

An order is created in the `PLACED` status but the restaurant queue only shows orders where `Payment.status = 'PAID'`. Payment becomes PAID in exactly one place: `lib/orders/payment.ts#markOrderPaid`. In production this is called by the Stripe webhook. In development/E2E a `devMarkPaid` Server Action (disabled in production) calls the same function. The queue implementation is `app/(restaurant)/_lib/queue.ts`.

### Atomic driver claim

When a driver claims an order the action issues a single conditional `updateMany`:

```sql
UPDATE "Order"
SET status = 'OUT_FOR_DELIVERY', "driverId" = <driver.id>
WHERE id = <orderId> AND status = 'READY' AND "driverId" IS NULL
```

If the count of updated rows is 0, `lib/orders/claim.ts#assertClaimed` throws `AlreadyClaimedError`. Because this is a single database operation, two drivers clicking "Claim" simultaneously result in exactly one winner and one error — no application-level lock needed.

### Money: integer cents everywhere

All money is stored and computed as integer cents. No floats. The delivery fee is the constant `FLAT_DELIVERY_FEE_CENTS = 299` (i.e. $2.99) defined in `lib/orders/fees.ts`. At checkout: `totalCents = subtotalCents + deliveryFeeCents`. All of these are snapshotted onto the `Order` row so later price or fee changes never affect historical orders.

---

## 3. Database Design

### Client generation

Prisma 7 generates the client into the repository at `lib/generated/prisma/`. **Import from `@/lib/generated/prisma/client`, not from `@prisma/client`**, or the project will not compile. Always use the singleton from `lib/db.ts` — never construct `new PrismaClient()` ad hoc.

Prisma 7 also connects via a `pg` driver adapter rather than reading `DATABASE_URL` directly from the environment. The adapter is set up in `lib/db.ts`, which validates the env var at startup and exposes the shared `prisma` instance.

Sources: `.claude/rules/data-access.md`, `lib/db.ts`, `prisma/schema.prisma`.

### Enums

| Enum | Values |
|---|---|
| `Role` | `CUSTOMER`, `RESTAURANT`, `DRIVER`, `ADMIN` |
| `RestaurantStatus` | `PENDING`, `APPROVED`, `SUSPENDED` |
| `DriverStatus` | `PENDING`, `APPROVED`, `SUSPENDED` |
| `OrderStatus` | `PLACED`, `ACCEPTED`, `PREPARING`, `READY`, `OUT_FOR_DELIVERY`, `DELIVERED`, `REJECTED`, `CANCELLED` |
| `PaymentStatus` | `PENDING`, `PAID`, `FAILED` |

### Models

#### User
Central auth entity. Every role has a User row.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `email` | String | unique |
| `name` | String? | optional |
| `passwordHash` | String | bcrypt |
| `role` | Role | default CUSTOMER |
| `createdAt`, `updatedAt` | DateTime | |

Relations: has one `Restaurant?`, one `Driver?`, many `Address[]`, many `Order[]` (as customer).

#### Restaurant
One-to-one with its owner `User`. An admin must set status to `APPROVED` before customers can see it.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `ownerId` | String | unique FK → User (cascade delete) |
| `name`, `cuisine` | String | |
| `status` | RestaurantStatus | default PENDING |
| `isAcceptingOrders` | Boolean | default true; owner toggles this |
| `hours`, `deliveryArea` | String? | optional display info |

Index on `status`.

#### Driver
One-to-one with its User. An admin must approve before the driver can claim orders.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `userId` | String | unique FK → User (cascade delete) |
| `name`, `phone?` | String | |
| `status` | DriverStatus | default PENDING |
| `isOnline` | Boolean | default false; driver toggles this |

Index on `status`.

#### MenuCategory
Belongs to a Restaurant. Contains items.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `restaurantId` | String | FK → Restaurant (cascade) |
| `name` | String | |
| `sortOrder` | Int | default 0 |

Index on `restaurantId`.

#### MenuItem
Belongs to a MenuCategory. Prices here are live (editable); they are snapshotted to `OrderItem` at purchase time.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `categoryId` | String | FK → MenuCategory (cascade) |
| `name`, `description?` | String | |
| `priceCents` | Int | live price, integer cents |
| `imageUrl?` | String | optional |
| `isAvailable` | Boolean | default true |
| `isVeg` | Boolean | default true |

Index on `categoryId`.

#### Address
Delivery address belonging to a User. Multiple addresses per user are stored but the current checkout uses a free-text field (see Limitations).

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `userId` | String | FK → User (cascade) |
| `line1`, `city`, `postcode` | String | |

Index on `userId`.

#### Order
Central order entity. Contains snapshotted money values that never change after checkout.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `customerId` | String | FK → User (no cascade) |
| `restaurantId` | String | FK → Restaurant (no cascade) |
| `driverId` | String? | nullable FK → Driver (SetNull on delete) |
| `status` | OrderStatus | default PLACED |
| `prepMinutes` | Int? | set by restaurant on accept |
| `subtotalCents` | Int | snapshot at checkout |
| `deliveryFeeCents` | Int | snapshot at checkout, default 0 |
| `totalCents` | Int | subtotal + fee, snapshot |
| `addressLine` | String | free-text snapshot of delivery address |

Indexes: `(restaurantId, status)`, `(customerId)`, `(status, driverId)` — the last one supports the pool query.

#### OrderItem
Snapshot of each cart line at the moment of purchase. Name and price are frozen.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `orderId` | String | FK → Order (cascade) |
| `name` | String | snapshot from MenuItem.name |
| `priceCents` | Int | snapshot from MenuItem.priceCents |
| `quantity` | Int | |

Index on `orderId`.

#### Payment
One-to-one with Order. Created as `PENDING` at checkout; flipped to `PAID` by the Stripe webhook (or by `devMarkPaid` in development).

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `orderId` | String | unique FK → Order (cascade) |
| `stripeSessionId` | String? | persisted when a Checkout session is created |
| `status` | PaymentStatus | default PENDING |

#### OrderStatusEvent
Append-only audit trail. Every transition writes one row.

| Field | Type | Notes |
|---|---|---|
| `id` | String (cuid) | PK |
| `orderId` | String | FK → Order (cascade) |
| `from` | OrderStatus? | null for the initial PLACED event |
| `to` | OrderStatus | the new status |
| `byUserId` | String? | who triggered it |
| `createdAt` | DateTime | |

Index on `orderId`.

### ER overview (text)

```
User 1──1 Restaurant 1──* MenuCategory 1──* MenuItem
User 1──1 Driver
User 1──* Address
User 1──* Order (as customer)

Restaurant 1──* Order
Driver 1──* Order (nullable — assigned on claim)
Order 1──* OrderItem
Order 1──1 Payment
Order 1──* OrderStatusEvent
```

---

## 4. APIs

### Route Handlers

These are the only `route.ts` files in the project. All others are Server Actions.

| Path | Method | Purpose | Auth check |
|---|---|---|---|
| `POST /api/stripe/webhook` | POST | Verifies Stripe HMAC signature; on `checkout.session.completed` calls `markOrderPaid` | Stripe signature — no session |
| `GET /restaurant/orders/queue` | GET | JSON for the SWR queue board; envelope `{ok, data, error}` | Session role = RESTAURANT; re-verified via `getOwnedRestaurant()` |
| `GET /driver/pool/api` | GET | JSON for the SWR driver pool board; envelope `{ok, data, error}` | Session role = DRIVER; re-verified via `getDriver()` with status check |
| `GET /orders/[id]/status` | GET | JSON for the customer tracking SWR hook; envelope `{ok, data, error}` | Session user; order scoped to `customerId` |

Sources: `app/api/stripe/webhook/route.ts`, `app/(restaurant)/restaurant/orders/queue/route.ts`, `app/(driver)/driver/pool/api/route.ts`, `app/(customer)/orders/[id]/status/route.ts`.

#### JSON envelope

All Route Handlers that return data use this shape:

```ts
{ ok: boolean; data: T | null; error: string | null }
```

A 401 or 403 returns `{ ok: false, data: null, error: "..." }` with the appropriate HTTP status. A 404 returns the same shape so a caller can never infer whether an id exists or is forbidden.

### Server Actions

All mutations. Each one (a) re-verifies ownership, (b) passes through `assertTransition` for status changes, (c) ends with `revalidatePath`.

#### Auth — `app/(auth)/actions.ts`

| Action | What it does |
|---|---|
| `signInAction` | Verifies credentials via Auth.js; redirects to the role's home page |
| `signUpAction` | Creates `User`; for `DRIVER` role also creates a `PENDING Driver` row atomically; signs in and redirects |
| `signOutAction` | Signs out and redirects to `/` |

#### Customer — `app/(customer)/checkout/actions.ts` and `app/(customer)/orders/[id]/actions.ts`

| Action | Ownership check | What it does |
|---|---|---|
| `placeOrder` | `requireCustomerId()` | Validates all cart items against the live menu (re-reads prices from DB); creates `Order` + `OrderItem[]` + `Payment(PENDING)` + initial `OrderStatusEvent` in one transaction; redirects to order tracking |
| `createCheckoutSession` | `requireCustomerId()` + order scoped to `customerId` | Creates a Stripe Checkout session; persists `stripeSessionId` on `Payment`; returns the session URL |
| `devMarkPaid` | `requireCustomerId()` + order scoped to `customerId` | DEV ONLY — calls `markOrderPaid`; blocked in production |
| `cancelOrder` | `requireCustomerId()` + order scoped to `customerId` | Calls `assertTransition(status, 'CANCELLED', 'CUSTOMER')`; updates status + appends event in one transaction |

#### Restaurant — `app/(restaurant)/restaurant/orders/[id]/actions.ts`

All four actions share the `advanceOrder` helper which calls `requireOwnedRestaurant()`, verifies `order.restaurantId === restaurant.id`, and calls `assertTransition(from, to, 'RESTAURANT')`.

| Action | Transition fired |
|---|---|
| `acceptOrder` | `PLACED → ACCEPTED` (also sets optional `prepMinutes`) |
| `rejectOrder` | `PLACED → REJECTED` |
| `startPreparing` | `ACCEPTED → PREPARING` |
| `markReady` | `PREPARING → READY` |

#### Restaurant — `app/(restaurant)/restaurant/menu/actions.ts`

| Action | Ownership check | What it does |
|---|---|---|
| `createCategory` | `requireOwnedRestaurant()` | Creates a MenuCategory for this restaurant |
| `renameCategory` | `requireOwnedRestaurant()` | `updateMany where id AND restaurantId` (foreign id = no-op) |
| `deleteCategory` | `requireOwnedRestaurant()` | `deleteMany where id AND restaurantId` |
| `createItem` | `requireOwnedRestaurant()` + `assertOwnsCategory` | Creates a MenuItem under the verified category |
| `updateItem` | `requireOwnedRestaurant()` + item→category→restaurant chain | Updates item fields |
| `deleteItem` | `requireOwnedRestaurant()` + category chain | `deleteMany` scoped through category |
| `toggleItemAvailability` | `requireOwnedRestaurant()` + category chain | Flips `isAvailable` |

#### Restaurant — `app/(restaurant)/restaurant/profile/actions.ts`

| Action | Ownership check | What it does |
|---|---|---|
| `updateProfile` | `requireOwnedRestaurant()` | Updates name, cuisine, hours, deliveryArea (status NOT editable here) |
| `toggleAcceptingOrders` | `requireOwnedRestaurant()` | Flips `isAcceptingOrders` |

#### Driver — `app/(driver)/_lib/actions.ts` and `app/(driver)/driver/order/[id]/actions.ts`

| Action | Ownership check | What it does |
|---|---|---|
| `setDriverOnline` | `requireApprovedDriver()` | Toggles `Driver.isOnline` |
| `claimOrder` | `requireApprovedDriver()` + checks `driver.isOnline` | Atomic `updateMany where status=READY AND driverId=null`; writes event; throws `AlreadyClaimedError` on 0 rows |
| `markDelivered` | `requireApprovedDriver()` + `order.driverId === driver.id` | `assertTransition(status, 'DELIVERED', 'DRIVER')`; updates + appends event |

#### Admin — `app/(admin)/admin/restaurants/actions.ts`, `app/(admin)/admin/drivers/actions.ts`, `app/(admin)/admin/orders/actions.ts`

All admin actions call `assertAdmin()` (re-verifies `session.user.role === 'ADMIN'`) before touching anything.

| Action | What it does |
|---|---|
| `approveRestaurant` | Sets `Restaurant.status = 'APPROVED'` |
| `suspendRestaurant` | Sets `Restaurant.status = 'SUSPENDED'` |
| `approveDriver` | Sets `Driver.status = 'APPROVED'` |
| `suspendDriver` | Sets `Driver.status = 'SUSPENDED'` |
| `adminMarkPaid` | Calls `markOrderPaid` — unblocks orders stuck with missed webhook |
| `forceCancelOrder` | `assertTransition(status, 'CANCELLED', 'ADMIN')`; nulls `driverId`; appends event |
| `reassignDriver` | Verifies target driver is `APPROVED`; `updateMany where id AND status=OUT_FOR_DELIVERY`; writes audit event with `from=to=OUT_FOR_DELIVERY` |

---

## 5. End-to-End Workflows

### Customer: discover → pay → track

1. Customer browses `/browse` — only `APPROVED` restaurants with `isAcceptingOrders = true` are shown.
2. Clicks a restaurant, views its menu at `/restaurants/[id]`.
3. Adds items to the cart (React context + localStorage). Adding from a different restaurant prompts to clear the existing cart (single-restaurant rule).
4. Goes to `/cart`, reviews items and the $2.99 delivery fee.
5. Clicks "Proceed to checkout" → `/checkout`.
6. Enters a delivery address, submits. `placeOrder` action runs:
   - Re-reads all prices from the DB (price snapshot).
   - Creates `Order(PLACED)` + `OrderItem[]` + `Payment(PENDING)` + initial `OrderStatusEvent` in one transaction.
   - Redirects to `/orders/[id]`.
7. At `/orders/[id]`, the order shows "awaiting payment".
   - **Dev mode:** a "Mark as paid (dev)" button calls `devMarkPaid`.
   - **Production:** a "Pay with Stripe" button calls `createCheckoutSession`, redirecting the customer to Stripe's hosted checkout. On success, Stripe posts `checkout.session.completed` to `/api/stripe/webhook`, which calls `markOrderPaid`.
8. Once paid, the order appears in the restaurant queue. The customer tracking page polls `GET /orders/[id]/status` via SWR to show real-time status and the event timeline.
9. Customer can cancel from `PLACED` status only (before acceptance).

### Restaurant: accept → prepare → ready

1. Restaurant owner logs in and sees `/restaurant` — the SWR-polled queue board.
2. Queue groups: **New** (PAID + PLACED), **In Progress** (ACCEPTED, PREPARING, OUT_FOR_DELIVERY), **Ready** (READY — awaiting driver), **Completed** (DELIVERED, REJECTED, CANCELLED).
3. Opens an order from the New column. Can Accept (optionally setting prep minutes) or Reject.
4. After accepting: marks "Start preparing" → `ACCEPTING → PREPARING`.
5. After preparing: marks "Mark ready" → `PREPARING → READY`. At this point the order enters the driver pool and no further restaurant actions exist on it.
6. The restaurant cannot mark the order delivered — the delivery leg is driver-only.

### Driver: claim → deliver → earn

1. Driver logs in at `/driver`. Must be `APPROVED` and have `isOnline = true` (toggle available on the dashboard).
2. Goes to `/driver/pool` — the SWR-polled pool board showing PAID, unclaimed, READY orders.
3. Clicks "View & claim" on an order. The claim action runs: `updateMany where status=READY AND driverId=null`. If 0 rows updated, another driver already claimed it — `AlreadyClaimedError` is shown.
4. On success, the order moves to `/driver/deliveries` as `OUT_FOR_DELIVERY`.
5. Driver navigates to the order at `/driver/order/[id]`, marks it delivered.
6. Driver sees earnings at `/driver/earnings` — the sum of `deliveryFeeCents` over all `DELIVERED` orders (display only; no actual payouts).

### Admin: approve restaurants and drivers

1. Admin logs in at `/admin` — the overview dashboard with platform KPI cards.
2. `/admin/restaurants` — lists all restaurants with their status. Can approve (PENDING or SUSPENDED → APPROVED) or suspend (APPROVED → SUSPENDED).
3. `/admin/drivers` — same pattern for drivers.
4. `/admin/orders` — lists all orders. Can:
   - **adminMarkPaid** — unblocks an order with a missed Stripe webhook.
   - **forceCancelOrder** — cancels any non-terminal order regardless of who owns it; nulls `driverId`.
   - **reassignDriver** — swaps the driver on an `OUT_FOR_DELIVERY` order (only to APPROVED drivers); writes an audit event.
5. `/admin/users` — lists all users (read-only).

---

## 6. Permissions Matrix

### Route guard (first layer — `proxy.ts`)

| Route prefix | CUSTOMER | RESTAURANT | DRIVER | ADMIN | Unauthenticated |
|---|---|---|---|---|---|
| `/admin/**` | redirect /signin | redirect /signin | redirect /signin | allowed | redirect /signin |
| `/restaurant/**` | redirect /signin | allowed | redirect /signin | redirect /signin | redirect /signin |
| `/driver/**` | redirect /signin | redirect /signin | allowed | redirect /signin | redirect /signin |
| `/cart`, `/checkout`, `/orders`, `/account` | allowed | redirect /signin | redirect /signin | redirect /signin | redirect /signin |
| `/browse`, `/restaurants/**`, `/` | allowed | allowed | allowed | allowed | allowed |

### Ownership rules (second layer — per action)

The route guard only validates the role. Every action also validates ownership:

| Role | Ownership helper | Enforcement |
|---|---|---|
| CUSTOMER | `requireCustomerId()` in `app/(customer)/_lib/customer.ts` | All order reads/mutations scope to `customerId = session.user.id` |
| RESTAURANT | `requireOwnedRestaurant()` in `app/(restaurant)/_lib/restaurant.ts` | Returns the restaurant whose `ownerId = session.user.id`; all mutations use that restaurant's id |
| DRIVER | `requireApprovedDriver()` in `app/(driver)/_lib/driver.ts` | Returns the Driver whose `userId = session.user.id` AND whose status is `APPROVED`; claim and deliver scope to `driverId = driver.id` |
| ADMIN | `assertAdmin()` (inline in each admin actions file) | Re-verifies `session.user.role === 'ADMIN'`; no ownership restriction (admin is cross-tenant) |

### What each role can and cannot do

| Action | CUSTOMER | RESTAURANT | DRIVER | ADMIN |
|---|---|---|---|---|
| Browse restaurants | yes | yes | yes | yes |
| Place order | yes | no | no | no |
| Cancel own PLACED order | yes | no | no | no (but can force-cancel) |
| View own orders | yes | no | no | no |
| Force-cancel any order | no | no | no | yes |
| Accept/reject/cook/mark ready | no | own orders only | no | yes |
| Claim a READY order | no | no | approved+online only | yes |
| Mark order delivered | no | no | own claimed orders only | yes |
| Edit own menu | no | own restaurant only | no | no |
| Edit own profile | no | own restaurant only | no | no |
| Toggle accepting orders | no | own restaurant only | no | no |
| Toggle online status | no | no | own profile only | no |
| Approve/suspend restaurant | no | no | no | yes |
| Approve/suspend driver | no | no | no | yes |
| Force-mark order paid | no | no | no | yes |
| Reassign driver on order | no | no | no | yes |

---

## 7. Environment Setup

### Prerequisites

- Node.js 20+
- pnpm (used as the package manager throughout)
- PostgreSQL running locally (or a Vercel Postgres / Neon connection string)

### Environment variables

Copy `.env.example` to `.env` and fill in all values. The `.env` file is gitignored. Never commit secrets.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string. Example: `postgresql://postgres:postgres@localhost:5432/food_delivery?schema=public` |
| `AUTH_SECRET` | yes | Signs/encrypts the session JWT. Generate with `npx auth secret` or `openssl rand -base64 32`. Auth.js reads this automatically. |
| `STRIPE_SECRET_KEY` | yes for real Stripe | Test-mode key (starts with `sk_test_`). Used by `lib/stripe.ts` to create Checkout sessions and verify webhook signatures. |
| `STRIPE_WEBHOOK_SECRET` | yes for webhook | HMAC secret for verifying Stripe events. From `stripe listen --forward-to localhost:3000/api/stripe/webhook` locally, or from the Stripe Dashboard in production. |
| `NEXT_PUBLIC_APP_URL` | yes for Stripe | Absolute base URL for Stripe's success/cancel redirects. Set to `http://localhost:3000` locally, your Vercel URL in production. |

Source: `.env.example`.

### Local database setup

```bash
# 1. Create the database (if it does not exist)
createdb food_delivery

# 2. Apply all migrations
pnpm prisma migrate dev

# 3. Load deterministic seed data
pnpm db:seed
```

The seed creates six user accounts (all with password `password123`):

| Email | Role | Notes |
|---|---|---|
| `admin@demo.test` | ADMIN | |
| `owner@demo.test` | RESTAURANT | Mario's Pizza, APPROVED, menu with Margherita + Pepperoni |
| `owner2@demo.test` | RESTAURANT | Spice Hub, APPROVED |
| `customer@demo.test` | CUSTOMER | |
| `driver@demo.test` | DRIVER | APPROVED, isOnline=true |
| `driver2@demo.test` | DRIVER | APPROVED, isOnline=true (for the atomic-claim E2E test) |

The seed also creates: 3 PAID PLACED orders for Mario's (for the restaurant queue E2E), 2 PAID unclaimed READY orders (one for the driver happy-path, one for the already-claimed test), 1 PAID PLACED order for Spice Hub (cross-tenant isolation test), and 1 UNPAID PLACED order with sentinel total $77.77 (payment-gate test).

The seed is idempotent (uses upserts) — re-running it resets mutable fields without creating duplicates.

Source: `prisma/seed.ts`.

### pnpm commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start the development server (Next.js with Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests (state machine, fees, claim, cart, earnings, Stripe events) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm test:all` | `pnpm test && pnpm build && pnpm test:e2e` — full suite run |
| `pnpm db:seed` | Load/reset deterministic seed data |
| `pnpm prisma migrate dev` | Apply schema migrations locally (also regenerates the Prisma client) |

---

## 8. Deployment

### Platform

Deployed on **Vercel** with **Vercel Postgres** or **Neon** as the managed PostgreSQL database.

### Steps

1. Push the branch to GitHub and connect the repository to Vercel.
2. Set all environment variables in the Vercel project settings (same list as the `.env.example` section above).
3. On first deploy (or after schema changes): run `pnpm prisma migrate deploy` in the Vercel build command or via a one-off Vercel function. This applies all pending migrations against the production database. Note: `migrate deploy` applies existing migration files — it does not generate new ones.
4. The seed (`pnpm db:seed`) should only be run against a fresh database. Do not run it in production against an existing dataset — it is idempotent for users but will add more orders if none exist.

### Stripe webhook in production

1. In the Stripe Dashboard, create a webhook pointing to `https://your-app.vercel.app/api/stripe/webhook`.
2. Subscribe to the `checkout.session.completed` event.
3. Copy the signing secret and set it as `STRIPE_WEBHOOK_SECRET` in Vercel.

### Stripe webhook locally

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the whsec_... signing secret printed by the CLI into .env as STRIPE_WEBHOOK_SECRET.
```

Note: locally, the application also ships a dev-only "Mark as paid" button that bypasses Stripe entirely (calls `devMarkPaid`). This is disabled in production (`NODE_ENV === 'production'` check in the action).

---

## 9. Testing

### Unit tests (Vitest)

Run with `pnpm test`. These tests have no database or network dependencies — they test pure logic only.

| Test file | What it covers | What it does NOT cover |
|---|---|---|
| `lib/orders/state.test.ts` | All legal transitions; all illegal transitions; `isTerminal`; `nextStatuses` return values; actor authorization for every edge; admin force-cancel; graph illegality beats actor | Database-layer transition execution |
| `lib/orders/fees.test.ts` | `FLAT_DELIVERY_FEE_CENTS` is a positive integer; matches the seed fixture value $2.99 | Dynamic fee calculation (the fee is a constant) |
| `lib/orders/claim.test.ts` | `assertClaimed(1)` does not throw; `assertClaimed(0)` throws `AlreadyClaimedError`; any non-positive count is already-claimed | The database updateMany itself |
| `lib/orders/stripe-events.test.ts` | `orderIdFromCheckoutSession` extracts orderId from a completed session; returns null without orderId in metadata; returns null for non-completed event types | Real Stripe API; network |
| `app/(customer)/_lib/cart.test.ts` | `addItem`, `removeItem`, `setQuantity`, `cartSubtotalCents`, `cartItemCount`, `isDifferentRestaurant`; immutability (input cart not mutated); single-restaurant conflict; empty cart edge cases | Cart persistence to localStorage; cart context rendering |
| `app/(driver)/_lib/deliveries.test.ts` | `sumDeliveredFees` sums only DELIVERED orders; zero for no delivered orders; returns an integer | Database earnings query; `getMyDeliveries` |

### E2E tests (Playwright)

Run with `pnpm test:e2e`. These tests drive a real browser (Chromium, headed — not headless) against a running dev server with a live PostgreSQL database.

**Precondition before every E2E run:** apply migrations and reseed.

```bash
pnpm prisma migrate dev
pnpm db:seed
pnpm dev   # in another terminal
pnpm test:e2e
```

#### Configuration rationale

From `playwright.config.ts`: `workers: 1` (a single serial worker). The reason is that all specs share one PostgreSQL database. Parallel workers could let, say, the customer spec and the restaurant spec race on the same order queue. Serial execution eliminates that race without needing transactional rollbacks between tests.

#### E2E specs

| Spec file | What it covers | What it does NOT cover |
|---|---|---|
| `e2e/auth.spec.ts` | Sign in (customer, owner, driver, admin); sign up (customer); role-home redirect after login | OAuth providers; password reset |
| `e2e/role-isolation.spec.ts` | Unauthenticated redirects for all protected routes; public routes stay accessible; each role is redirected away from other roles' dashboards | Ownership/tenant scoping (layer 2); driver page content |
| `e2e/customer.spec.ts` | Customer places order, pays (stub), tracks to READY; ownership 404 (cannot view another user's order); cancel before acceptance; single-restaurant conflict | Real Stripe; driver claim/deliver; multi-address book |
| `e2e/restaurant-fulfillment.spec.ts` | Owner advances PAID order accept→prepare→ready; no actions shown at READY; reject order; payment gate (unpaid order invisible in queue); cross-tenant isolation (owner2 cannot see owner1's orders) | Menu/profile CRUD; driver claim; atomic-claim race |
| `e2e/driver.spec.ts` | Approved driver claims READY order; marks delivered; earnings increment; second driver attempting already-claimed order sees error; PENDING driver cannot reach the pool | Real concurrency race; online/offline toggle; full customer→driver loop |
| `e2e/admin.spec.ts` | Admin suspend + re-approve a restaurant; overview KPI cards render | Users screen; payment math; driver approval; pagination |
| `e2e/phase5b-gating.spec.ts` | Covers phase 5 gating scenarios (design extras, toggles) | See file for specifics |

---

## 10. Known Limitations

These are accurate descriptions of the current state of the code, not aspirational goals.

1. **Stripe requires real test keys to process payments.** The app ships a dev-only "Mark as paid (dev)" button that bypasses Stripe entirely. In production the button is disabled, but a `STRIPE_SECRET_KEY` starting with `sk_test_` is still required for the Checkout session creation action. Without it, `lib/stripe.ts` throws at request time.

2. **Single free-text delivery address at checkout.** The `Address` model exists in the schema and users can have many addresses, but the checkout form uses a plain text field (`addressLine`) rather than a saved address picker. There is no multi-address management UI. The `Address` model is currently unused by the checkout flow.

3. **No GPS, no live driver location.** The delivery leg is entirely status-driven. The customer sees status transitions (OUT_FOR_DELIVERY, DELIVERED) but no map or ETA.

4. **No auto-dispatch.** Drivers self-select orders from a shared pool. No algorithm assigns orders to specific drivers.

5. **No real payouts.** Driver earnings are computed as the sum of `deliveryFeeCents` over their delivered orders and displayed on the earnings page. This is a display calculation only — there is no integration with Stripe Connect, bank transfers, or any payout mechanism.

6. **Emoji + gradient imagery.** The restaurant and menu displays use emoji characters and CSS gradients as placeholders. The `MenuItem.imageUrl` field exists in the schema but there is no image upload flow.

7. **No real-time updates.** The restaurant queue, driver pool, and customer tracking page use SWR polling (default intervals). Status changes appear after the next poll cycle, not instantly.

8. **No ratings or reviews.** There is no review model in the schema.

9. **No multi-currency or region support.** The currency is hardcoded to USD in Stripe line items. There is no localization.

10. **No password reset.** Auth is email/password via Auth.js credentials. There is no "forgot password" flow.

11. **Single Stripe webhook event.** Only `checkout.session.completed` is handled. `payment_intent.payment_failed` and other failure events are not processed.

---

## 11. Future Enhancements

These are items explicitly called out in the PRD or implementation roadmap as in-scope for later phases, not arbitrary wishlist items.

1. **Multi-address book.** Allow customers to save multiple delivery addresses and select one at checkout. The `Address` model already exists in the schema.

2. **Real uploaded photos for restaurants and menu items.** Replace emoji/gradient placeholders with actual image upload (e.g. Vercel Blob or an S3-compatible store) using `MenuItem.imageUrl` and a new restaurant logo field.

3. **Ratings and reviews.** Post-delivery, the customer rates the restaurant (and optionally the driver). Requires a new `Review` model.

4. **Prep-time display.** Surface `Order.prepMinutes` (set by the restaurant at acceptance) on the customer tracking page as an ETA.

5. **Driver online/offline toggle with pool visibility gating.** Currently the toggle exists and is stored in `Driver.isOnline`, and the `claimOrder` action checks it. The pool board could be hidden entirely when the driver is offline.

6. **Push notifications.** Notify the customer when their order status changes. Would require a push notification service (e.g. web push or a third-party like Knock/Novu). The current design uses polling; this would replace or augment it.

7. **Admin driver approval and override screens.** The approval/suspend Server Actions exist (`approveDriver`, `suspendDriver`, `forceCancelOrder`, `reassignDriver`). The UI for these on the admin panel is a future wiring task.

8. **Restaurant open/closed toggle.** The `Restaurant.isAcceptingOrders` field and the `toggleAcceptingOrders` action already exist. A dedicated UI toggle on the restaurant profile or dashboard is the remaining work.

9. **Hardening and production deployment.** Rate limiting on all endpoints, error monitoring (e.g. Sentry), CSP headers, automated CI/CD pipeline, load testing (JMeter as specified in the project testing strategy).
