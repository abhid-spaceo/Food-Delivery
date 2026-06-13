# Customer Module

## 1. Purpose

Lets a logged-in customer (or anonymous browser) discover restaurants, build a cart, place an order, pay for it, and track it through to delivery. This is the demand side of the marketplace.

---

## 2. Features

- **Browse page** (`/browse`) — publicly accessible; lists only `APPROVED` restaurants. Supports text search (name, case-insensitive) and cuisine-type filter chips, both via GET query params so the page stays a Server Component.
- **Restaurant detail page** (`/restaurants/[id]`) — publicly accessible; shows the menu grouped by category. Only `AVAILABLE` items appear. Closed ("not accepting orders") restaurants show a note instead of Add buttons. Non-approved or unknown IDs return 404.
- **Add to cart** — client-side `<AddToCartButton>` increments the cart in React context + `localStorage`. Shows a confirm dialog if the user tries to add from a different restaurant (single-restaurant cart enforcement).
- **Cart page** (`/cart`) — line-item editor; increase/decrease/remove items; shows the delivery fee (`$2.99`) and total.
- **Checkout page** (`/checkout`) — delivery address form; submits the `placeOrder` server action.
- **Order confirmation + tracking** (`/orders/[id]`) — shows payment status, item/fee summary, a "Mark as paid (dev)" button while payment is pending, a "Cancel order" button while still `PLACED`, and a live tracking timeline polled via SWR every 5 s.
- **Order history** (`/orders`) — list of the customer's own orders (newest first) with status chips.
- **Stripe checkout** — "Pay now" button redirects to a hosted Stripe session; on success the webhook marks the order paid.

---

## 3. User Flow

### Happy path (place → pay → track)

1. Customer navigates to `/browse` (no login required to view).
2. Clicks a restaurant card → lands on `/restaurants/[id]`.
3. Clicks **Add** on one or more items → cart badge increments.
4. Clicks the cart link → `/cart`; reviews items and total.
5. Clicks **Proceed to checkout** → `/checkout`; enters delivery address; clicks **Place order**.
6. Redirected to `/orders/[id]?placed=1`; cart is cleared client-side on mount.
7. Clicks **Mark as paid (dev)** (dev stub) or **Pay now** (Stripe hosted page) to complete payment.
8. Status timeline begins polling; restaurant sees the order; advances it through `ACCEPTED → PREPARING → READY`.
9. A driver claims and delivers; status eventually becomes `DELIVERED`.

### Cancel path

- While the order is still `PLACED` (before any restaurant action), the customer sees a **Cancel order** button. Clicking it (with a browser confirm dialog) calls `cancelOrder`, which uses the state machine to fire `PLACED → CANCELLED`.

### Single-restaurant conflict

- If the cart already holds items from Restaurant A and the customer tries to add from Restaurant B, a `window.confirm` dialog asks whether to replace the cart. Dismissing keeps the original cart unchanged.

---

## 4. Business Rules

- **Single-restaurant cart** — `isDifferentRestaurant` detects a conflict; `addItem` only replaces if the caller confirms. Enforced in `cart-context.tsx` (client) and also in `placeOrder` (server, re-validated against the DB).
- **APPROVED-only visibility** — browse and detail pages query `status: "APPROVED"`; non-approved IDs return 404 (no info leak).
- **Open/closed gating** — `isAcceptingOrders: false` hides Add buttons on the detail page and causes `placeOrder` to reject with an error message.
- **Price snapshotting** — `placeOrder` ignores client-supplied prices entirely; it re-reads `name` and `priceCents` from the DB. Only `menuItemId` and `quantity` are accepted from the client.
- **Payment gates the queue** — the order is created at `PLACED` with `Payment.status = PENDING`; the restaurant never sees it until the Stripe webhook (or dev stub) flips it to `PAID`.
- **Money in integer cents** — `priceCents`, `deliveryFeeCents`, `subtotalCents`, `totalCents` are all integers; `FLAT_DELIVERY_FEE_CENTS = 299`.
- **Customer-only cancel** — `cancelOrder` calls `assertTransition(status, "CANCELLED", "CUSTOMER")`, which the state machine allows only from `PLACED`.
- **Ownership scope** — every page and action resolves `session.user.id` and scopes queries to `customerId`; a foreign order ID returns 404.
- **Stripe idempotency** — `createCheckoutSession` checks `payment.status !== "PENDING"` before creating a new session to prevent double-charge.
- **Dev stub disabled in production** — `devMarkPaid` throws if `NODE_ENV === "production"`.

---

## 5. Technical Implementation

### Pages and components

| File | Role |
|---|---|
| `app/(customer)/browse/page.tsx` | Server Component; queries approved restaurants with optional search/cuisine filter |
| `app/(customer)/restaurants/[id]/page.tsx` | Server Component; queries restaurant + menu (available items only) |
| `app/(customer)/cart/page.tsx` | Client Component; reads `useCart()`; no server data |
| `app/(customer)/checkout/page.tsx` | Client Component; binds `placeOrder` via `useActionState` |
| `app/(customer)/orders/page.tsx` | Server Component; lists the customer's own orders |
| `app/(customer)/orders/[id]/page.tsx` | Server Component; order detail scoped to `customerId` |
| `app/(customer)/orders/[id]/_components/order-tracker.tsx` | Client Component; SWR polling every 5 s against the status route |
| `app/(customer)/orders/[id]/_components/cancel-order-button.tsx` | Client Component; calls `cancelOrder` action |
| `app/(customer)/orders/[id]/_components/pay-button.tsx` | Client Component; calls `createCheckoutSession` and redirects |
| `app/(customer)/orders/[id]/_components/mark-paid-button.tsx` | Client Component; calls `devMarkPaid` |
| `app/(customer)/orders/[id]/_components/clear-cart-on-mount.tsx` | Client Component; clears `localStorage` cart once after redirect from checkout |
| `app/(customer)/_components/add-to-cart-button.tsx` | Client Component; calls `useCart().add` with confirm dialog |
| `app/(customer)/_components/cart-button.tsx` | Client Component; shows cart item count badge |

### Server Actions

| File | Exported actions |
|---|---|
| `app/(customer)/checkout/actions.ts` | `placeOrder` — validates, snapshots prices, creates Order+Payment+event in one transaction; `createCheckoutSession` — creates Stripe hosted session; `devMarkPaid` — dev-only payment stub; `cancelOrder` — state-machine-guarded cancel |

### Route Handler (SWR endpoint)

| File | Route | Purpose |
|---|---|---|
| `app/(customer)/orders/[id]/status/route.ts` | `GET /orders/[id]/status` | Returns `{ ok, data: { status, paymentStatus, events }, error }` for the tracker; owner-scoped |

### Lib helpers

| File | Purpose |
|---|---|
| `app/(customer)/_lib/cart.ts` | Pure, immutable cart model (no React, no storage) |
| `app/(customer)/_lib/cart-context.tsx` | React context + `localStorage` persistence; wraps cart functions |
| `app/(customer)/_lib/customer.ts` | `getCustomerId` / `requireCustomerId` — second authz layer |
| `app/(customer)/_lib/format.ts` | `formatCents`, `statusLabel`, `orderRef` |
| `lib/orders/fees.ts` | `FLAT_DELIVERY_FEE_CENTS = 299` — single source of truth |
| `lib/orders/payment.ts` | `markOrderPaid` — idempotent payment flip used by both dev stub and Stripe webhook |
| `lib/orders/state.ts` | `assertTransition` — validates `PLACED → CANCELLED` with `CUSTOMER` actor |

### Ownership enforcement

1. `proxy.ts` (route guard): allows `CUSTOMER` role into `/cart`, `/checkout`, `/orders/**`.
2. Per-page/action: `requireCustomerId()` or `getCustomerId()` from session; Prisma queries add `where: { customerId }` so a foreign ID matches zero rows and returns 404.

---

## 6. Dependencies

- **State machine** (`lib/orders/state.ts`) — `assertTransition` used in `cancelOrder`.
- **Payment helper** (`lib/orders/payment.ts`) — `markOrderPaid` used in `devMarkPaid` and the Stripe webhook.
- **Fees** (`lib/orders/fees.ts`) — `FLAT_DELIVERY_FEE_CENTS` used in cart, checkout, and `placeOrder`.
- **Stripe** (`lib/stripe.ts`) — `getStripe()` used in `createCheckoutSession`.
- **Prisma** (`lib/db.ts`) — `prisma` singleton; models used: `Restaurant`, `MenuItem`, `MenuCategory`, `Order`, `OrderItem`, `Payment`, `OrderStatusEvent`.
- **SWR** (`swr`) — `OrderTracker` polls every 5 s; stops once `isTerminal`.
- **Auth** (`lib/auth.ts`) — `auth()` called inside `getCustomerId` / `requireCustomerId`.
- **shadcn/ui** — `Card`, `Button`, `Input`, `Label`, `StatusChip`, `Timeline`, `EmptyState`.

---

## 7. Test Coverage

### Unit tests

| File | What it covers |
|---|---|
| `app/(customer)/_lib/cart.test.ts` | `addItem`, `removeItem`, `setQuantity`, `cartSubtotalCents`, `cartItemCount`, `isDifferentRestaurant`; immutability; edge cases (empty cart, last item removal, qty 0) |
| `lib/orders/fees.test.ts` | Fee is a positive integer; matches seed value $2.99 |

### E2E tests (`e2e/customer.spec.ts`)

| Test | What it covers |
|---|---|
| `customer places an order, pays (stub), and tracks it to READY` | Full happy path: browse → cart → checkout → stub-pay → status tracks to READY |
| `ownership: unknown order id renders not-found` | Foreign/unknown order ID returns 404 |
| `customer can cancel an order while it is still PLACED` | Cancel button appears, confirm dialog, status becomes Cancelled |
| `single-restaurant cart: declining the replace prompt keeps the first item` | Conflict dialog — dismissing preserves original cart |

### Closed-store gate (`e2e/phase5b-gating.spec.ts`)

| Test | What it covers |
|---|---|
| `owner closes store; customer cannot place order; owner reopens; order goes through` | "Currently not accepting orders" shown, Add buttons absent when closed; flow unblocked after reopen |

### What is NOT covered by these tests

- Real Stripe payment (uses dev stub only).
- Address validation or multi-address book.
- Confirming the replace-cart prompt (only dismissal is tested).
- `CartProvider` hydration from `localStorage` (client-only behavior not accessible in Vitest unit tests).
- Cart-context unit tests (only pure `cart.ts` functions are unit-tested).
- Concurrent checkout races (two sessions placing the same items simultaneously).
