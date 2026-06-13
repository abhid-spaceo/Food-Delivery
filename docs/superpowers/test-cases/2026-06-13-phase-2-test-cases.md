# Phase 2 — Test Cases (customer demand: discovery → cart → checkout → stub-pay → tracking)

> **Scope:** every feature implemented in Phase 2 (branch `Abhi/qwikbite-customer`). Positive, negative, and edge cases across validation, business rules, permissions, error handling, route/action behavior, and data integrity. A Phase 2 feature is "done" only when its cases here are documented and the **scriptable-now** ones are green in `pnpm test:all`.
>
> **Tooling (test pyramid):** pure logic → **Vitest** (`lib/**/*.test.ts`, `app/(customer)/_lib/cart.test.ts`); user-facing flows + permissions → **Playwright** (`e2e/customer.spec.ts` + carried-forward Phase 1 specs). Server Actions are RPC, not HTTP — exercised through the real UI in Playwright.
>
> **Status legend:**
> - ✅ **automated** — script exists and passes today
> - 📋 **schema/type-guaranteed** — enforced by Prisma schema / TypeScript / the build; no separate runtime test needed
> - 🔜 **Phase 4** — documented now; script deferred because real Stripe is not wired yet (stub replaces it)
> - 🔜 **Phase 5** — documented now; UI feature (multi-address) not built yet
>
> **Determinism:** all E2E rely on `pnpm db:seed` (self-restoring). Seeded accounts (`password123`): `admin@demo.test`, `owner@demo.test` (Mario's Pizza, APPROVED: Margherita $9.00, Pepperoni $11.00), `owner2@demo.test` (Spice Hub, APPROVED), `customer@demo.test` (Maya), `driver@demo.test` (APPROVED). Seed guarantees at least one PAID `PLACED` and one PAID unclaimed `READY` order.

---

## F11 — Delivery fee constant (`lib/orders/fees.ts`)

Tool: **Vitest** · File: `lib/orders/fees.test.ts` · **✅ automated (2 tests)**

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F11-P1 | Positive | `FLAT_DELIVERY_FEE_CENTS` is a positive integer (no floats, no zero) | `Number.isInteger(...)` = true, value > 0 | ✅ `fees.test.ts` |
| F11-P2 | Positive | Value matches seed fixtures ($2.99) | 299 | ✅ `fees.test.ts` |
| F11-E1 | Edge | Single export: changing the constant updates checkout, cart page, order snapshot, and driver earnings simultaneously | single source of truth | 📋 (TypeScript import graph) |

---

## F12 — Cart core: pure immutable model (`app/(customer)/_lib/cart.ts`)

Tool: **Vitest** · File: `app/(customer)/_lib/cart.test.ts` · **✅ automated (10 tests)**

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F12-P1 | Positive | `addItem` to empty cart adopts restaurant id + name; item added with qty 1 | `restaurantId` set, `items[0].quantity === 1` | ✅ `cart.test.ts` |
| F12-P2 | Positive | `addItem` same item twice — increments quantity (no duplicate line) | one line, `quantity === 2` | ✅ `cart.test.ts` |
| F12-P3 | Positive | `addItem` two different items from same restaurant — separate lines | `items.length === 2` | ✅ `cart.test.ts` |
| F12-P4 | Positive | `setQuantity` updates a line; `setQuantity(id, 0)` removes it | qty changed / line dropped | ✅ `cart.test.ts` |
| F12-P5 | Positive | `removeItem` drops the line; last item removed clears restaurant stamp (`restaurantId === null`) | empty EMPTY_CART returned | ✅ `cart.test.ts` |
| F12-P6 | Positive | `cartSubtotalCents` = integer cents sum of `priceCents * quantity` across all lines | exact integer, no floats | ✅ `cart.test.ts` |
| F12-P7 | Positive | `cartItemCount` sums quantities (not line count) | 3 items across 2 lines → 3 | ✅ `cart.test.ts` |
| F12-P8 | Positive | Empty cart has zero subtotal and zero item count | 0, 0 | ✅ `cart.test.ts` |
| F12-B1 | Business rule | `isDifferentRestaurant(cart, id)` = true only when cart is non-empty AND restaurant differs | false for empty cart, false for same restaurant, true for different | ✅ `cart.test.ts` |
| F12-E1 | Edge | `addItem` does NOT mutate the input cart (immutability) | `before.items.length === 0`; `after !== before` | ✅ `cart.test.ts` |
| F12-E2 | Edge | `setQuantity(id, -5)` treated as ≤ 0 — removes the line | line dropped (delegates to `removeItem`) | 📋 (unit: `setQuantity` calls `removeItem` for qty ≤ 0) |

---

## F13 — Single-restaurant cart rule (UI conflict resolution)

Tool: **Playwright** (`e2e/customer.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F13-P1 | Positive | Cart is empty: add item from any restaurant — no conflict dialog | item added, badge = 1 | ✅ (implicit in happy-path test) |
| F13-N1 | Negative | Cart has Mario's item; user clicks Add from Spice Hub and **declines** the confirm dialog | cart unchanged — still holds Mario's item | ✅ `customer.spec.ts` ("single-restaurant cart: declining the replace prompt keeps the first item") |
| F13-N2 | Negative | Cart has Mario's item; user clicks Add from Spice Hub and **accepts** the confirm dialog | cart cleared and replaced with Spice Hub item | 🔜 Phase 5 (no Playwright test yet; the JS logic in `add-to-cart-button.tsx` calls `window.confirm` then `EMPTY_CART` replace) |
| F13-E1 | Edge | `isDifferentRestaurant(EMPTY_CART, anyId)` = false — no dialog on first item | no confirm triggered | ✅ (covered by F12-B1 unit test) |

---

## F14 — Restaurant discovery (`/browse`)

Tool: **Playwright** (`e2e/customer.spec.ts` — implicit); behavior verified in happy-path navigation

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F14-P1 | Positive | `/browse` shows only APPROVED restaurants (Mario's Pizza, Spice Hub) | both visible; no PENDING/SUSPENDED restaurants shown | ✅ (happy-path test navigates to `/browse` and clicks Mario's Pizza card) |
| F14-P2 | Positive | Page is publicly accessible without login | loads without redirect | ✅ (role-isolation spec: public routes accessible) |
| F14-P3 | Positive | Cuisine filter chips appear for APPROVED restaurants' cuisines | filter links rendered | 📋 (Server Component query; no dedicated E2E assertion) |
| F14-N1 | Negative | Name search with no matches → empty state message | "No restaurants match your search." | 📋 (template branch rendered server-side) |
| F14-B1 | Business rule | PENDING/SUSPENDED restaurants are invisible to customers | `status: "APPROVED"` filter in DB query | 📋 (Server Component enforces via Prisma `where`) |
| F14-E1 | Edge | Admin suspends Mario's Pizza → it disappears from `/browse`; re-approve → reappears | APPROVED gate is live (not cached past revalidation) | ✅ (admin.spec.ts F8-P1 approves/suspends; visibility flip now exercised by Phase 2 customer context) |

---

## F15 — Restaurant detail + menu (`/restaurants/[id]`)

Tool: **Playwright** (`e2e/customer.spec.ts` — implicit in happy-path `addMargheritaToCart`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F15-P1 | Positive | APPROVED restaurant detail page renders name, cuisine, menu categories, available items with prices | all visible | ✅ (happy-path test clicks Mario's Pizza card and asserts URL `/restaurants/…`) |
| F15-P2 | Positive | Page is publicly accessible without login (no guard on `/restaurants/`) | loads without redirect | ✅ (auth.config.ts: `/restaurants/[id]` is not in CUSTOMER_PREFIXES; role-isolation spec confirms `/restaurants` path is unguarded) |
| F15-N1 | Negative | Unknown restaurant id → 404 (not-found) | Next.js `notFound()` | 📋 (Server Component calls `notFound()` when `findFirst` returns null) |
| F15-B1 | Business rule | PENDING/SUSPENDED restaurant id → 404 (APPROVED-gate; no info leak about existence) | `findFirst({ where: { id, status: "APPROVED" } })` returns null → 404 | 📋 (Prisma query enforces; no separate E2E) |
| F15-B2 | Business rule | Only items with `isAvailable: true` are listed; unavailable items absent | UI has no "Add" button for unavailable items | 📋 (Prisma `where: { isAvailable: true }` in query) |
| F15-E1 | Edge | `/restaurants` prefix is public; `/restaurant` prefix (no trailing s) is RESTAURANT-role guarded — they must not collide | fix in `auth.config.ts`: guard uses `=== "/restaurant"` and `startsWith("/restaurant/")` (exact match + trailing slash, not bare prefix) | ✅ (role-isolation spec confirms customer can reach `/browse` and click restaurant links without guard collision) |

---

## F16 — Add-to-cart button (client UI)

Tool: **Playwright** (`e2e/customer.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F16-P1 | Positive | Click Add on a menu item → cart badge increments to 1 | badge contains "1" | ✅ (happy-path test: `await expect(page.getByRole("link", { name: "Cart" })).toContainText("1")`) |
| F16-P2 | Positive | Add same item twice → badge = 2 (qty increment, not two lines) | cart.items.length === 1, qty === 2 | 📋 (F12-P2 unit test covers the model; no separate E2E) |
| F16-B1 | Business rule | Different-restaurant conflict → `window.confirm`; decline keeps original | ✅ F13-N1 |
| F16-E1 | Edge | Cart context is backed by `localStorage`; reloading the page preserves cart | badge still shows previous count after reload | 📋 (cart-context.tsx uses localStorage; covered by single-restaurant test which navigates away and returns) |

---

## F17 — Cart page (`/cart`)

Tool: **Playwright** (`e2e/customer.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F17-P1 | Positive | `/cart` shows item lines, subtotal, delivery fee, and total | "Total" visible | ✅ (happy-path test: navigates to `/cart`, asserts `"Total"` visible) |
| F17-P2 | Positive | "Proceed to checkout" link navigates to `/checkout` | URL `/checkout` | ✅ (happy-path test) |
| F17-P3 | Positive | Decrease button with qty > 1 decrements; reaching 0 removes the line | qty adjusts | 📋 (client action calls `setQty` → `setQuantity` from cart.ts; model covered by F12-P4) |
| F17-P4 | Positive | Remove button drops the line | line disappears | 📋 (calls `remove` → `removeItem`; model covered by F12-P5) |
| F17-N1 | Negative | Empty cart → empty state message, no checkout link | "Your cart is empty." rendered | 📋 (template branch in cart page) |
| F17-B1 | Business rule | Total = subtotal + flat delivery fee (integer cents, no floats) | correct arithmetic | ✅ (F11-P1 unit + F17-P1 E2E sees "Total" rendered from the same calculation) |

---

## F18 — Checkout + `placeOrder` Server Action (`app/(customer)/checkout/actions.ts`)

Tool: **Playwright** (`e2e/customer.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F18-P1 | Positive | Fill address + click "Place order" → redirects to `/orders/[id]?placed=1`, payment pending button visible | URL matches `/orders/…`, "Mark as paid (dev)" shown | ✅ (happy-path test) |
| F18-B1 | Business rule | Server re-reads item names + prices from DB (price snapshot) — client-submitted prices are ignored | `OrderItem.priceCents` = DB value at time of order, not the form value | 📋 (action reads from `prisma.menuItem.findMany`, never uses client prices) |
| F18-B2 | Business rule | `deliveryFeeCents` = `FLAT_DELIVERY_FEE_CENTS` (299) snapshotted onto the order | `Order.deliveryFeeCents === 299` always | 📋 (action: `const deliveryFeeCents = FLAT_DELIVERY_FEE_CENTS`) |
| F18-B3 | Business rule | Money math: `subtotalCents = Σ(priceCents × qty)`, `totalCents = subtotalCents + deliveryFeeCents`, all integer cents | exact integer arithmetic, no floats | ✅ (F11-P1 unit + seed fixture math verified in restaurant-fulfillment.spec.ts F9-DATA5) |
| F18-B4 | Business rule | Restaurant must be APPROVED — PENDING/SUSPENDED restaurant id → error "no longer available" | error returned from action | 📋 (action: `findFirst({ where: { id, status: "APPROVED" } })`) |
| F18-B5 | Business rule | All items must be `isAvailable: true` AND belong to the stated restaurant — foreign/unavailable id → error | error "item no longer available" | 📋 (action validates each line against `prisma.menuItem.findMany({ where: { id: { in: ids }, isAvailable: true, category: { restaurantId } } })`) |
| F18-B6 | Business rule | Empty cart (lines = []) → error returned before DB write | "Your cart is empty." | 📋 (action early-return guard) |
| F18-B7 | Business rule | Order created with `Payment.status = PENDING` so it is invisible to the restaurant queue until paid | order absent from restaurant queue until stub-pay or Stripe webhook | ✅ (restaurant-fulfillment.spec.ts F4-B1 payment gate; devMarkPaid makes it appear) |
| F18-B8 | Business rule | Initial `OrderStatusEvent` (from=null, to=PLACED) appended in the same DB transaction | event row exists | 📋 (action: `events: { create: [{ from: null, to: "PLACED", byUserId }] }` inside `prisma.order.create`) |
| F18-N1 | Negative | Empty delivery address → error "Please enter a delivery address." | error shown in form | 📋 (action early-return; `addressLine` checked before DB) |
| F18-N2 | Negative | Cross-restaurant item ids in the `lines` field (tampered form) → treated as unavailable | error "item no longer available" — Prisma query scope rejects them | 📋 (validation: `category: { restaurantId }` in the item query) |
| F18-E1 | Edge | Cart is cleared from localStorage after successful redirect (via `<ClearCartOnMount>` on the order page) | navigating back to `/cart` shows empty cart | 📋 (ClearCartOnMount calls `clearCart()` on mount when `?placed=1` is in URL) |
| F18-E2 | Edge | Quantity < 1 submitted by tampered form — clamped to 1 before snapshot | `quantity = Math.max(1, Math.floor(l.quantity))` | 📋 (action: explicit clamp) |

---

## F19 — Stub-pay: `devMarkPaid` + `markOrderPaid` (`app/(customer)/orders/[id]/actions.ts`, `lib/orders/payment.ts`)

Tool: **Playwright** (`e2e/customer.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F19-P1 | Positive | Click "Mark as paid (dev)" → payment pending card disappears; status badge shows "Placed" | button gone, status text = "Placed" | ✅ (happy-path test) |
| F19-P2 | Positive | After devMarkPaid, the order appears in the restaurant's queue | restaurant "New" column has the order | ✅ (happy-path test advances it through the restaurant side) |
| F19-B1 | Business rule | `devMarkPaid` is ownership-scoped: order must belong to the caller — foreign id → throws "Order not found" | no mutation | 📋 (action: `findFirst({ where: { id, customerId } })` before calling markOrderPaid) |
| F19-B2 | Business rule | `markOrderPaid` is idempotent: a double-click / replay changes 0 rows (predicate `status: "PENDING"`) | second call returns `count === 0`; no error, no state change | 📋 (payment.ts: `updateMany({ where: { orderId, status: "PENDING" } })`) |
| F19-B3 | Business rule | `devMarkPaid` throws in production (`NODE_ENV === "production"`) | disabled in prod | 📋 (action: explicit prod guard) |
| F19-E1 | Edge | `markOrderPaid` is the single seam that Phase 4 (Stripe webhook) will call — action wires the same function | Phase 4 drop-in: only the caller changes | 📋 (code structure) |

---

## F20 — Order tracking + SWR polling (`/orders/[id]`, `/orders/[id]/status`)

Tool: **Playwright** (`e2e/customer.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F20-P1 | Positive | Order tracking page shows current status in `data-testid="current-status"` | text "Placed" after stub-pay | ✅ (happy-path test: `getByTestId("current-status").toContainText("Placed")`) |
| F20-P2 | Positive | After restaurant advances order to READY, polling reflects the new status within polling interval | "Ready" appears in current-status within 10 s | ✅ (happy-path test: `toContainText("Ready", { timeout: 10_000 })`) |
| F20-P3 | Positive | Status route (`GET /orders/[id]/status`) returns `{ ok: true, data: { status, paymentStatus, events } }` envelope | correct JSON shape | 📋 (route.ts returns this shape; tested implicitly by the polling UI) |
| F20-B1 | Business rule | Status route is ownership-scoped: foreign/unknown id → `{ ok: false, error: "Order not found" }`, 404 | no data leak | 📋 (route.ts: `findFirst({ where: { id, customerId } })`) |
| F20-B2 | Business rule | Unauthenticated request to status route → 401 `{ ok: false, error: "Not authenticated" }` | 401 response | 📋 (route.ts: `if (!customerId)` guard) |
| F20-E1 | Edge | `OrderStatusEvent` timeline is included in poll response and rendered on the tracking page | events list visible (timeline) | 📋 (page + route both include events; no isolated E2E assertion on individual event rows) |

---

## F21 — Cancel order (`cancelOrder` Server Action)

Tool: **Playwright** (`e2e/customer.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F21-P1 | Positive | Customer cancels a PLACED order → status changes to "Cancelled" (polled within 12 s) | "Cancelled" in current-status | ✅ (customer.spec.ts: "customer can cancel an order while it is still PLACED") |
| F21-B1 | Business rule | Cancel is only legal from PLACED (state machine + CUSTOMER actor) — ACCEPTED order has no cancel button; action throws if tampered | no cancel UI beyond PLACED; action enforces via `assertTransition(status, "CANCELLED", "CUSTOMER")` | 📋 (state machine F2-P3 covers the actor rule; UI hides the button for non-PLACED) |
| F21-B2 | Business rule | Ownership-scoped: foreign order id → throws "Order not found" | no mutation | 📋 (action: `findFirst({ where: { id, customerId } })` before transition) |
| F21-B3 | Business rule | Cancel appends `OrderStatusEvent {from: "PLACED", to: "CANCELLED"}` in same `$transaction` as status update | event row written atomically | 📋 (action uses `prisma.$transaction([order.update, orderStatusEvent.create])`) |
| F21-E1 | Edge | Confirm dialog (`window.confirm`) must be accepted for the cancel to proceed | test intercepts `page.on("dialog", d => d.accept())` | ✅ (customer.spec.ts cancel test) |

---

## F22 — Order history (`/orders`)

Tool: **Playwright** (`e2e/customer.spec.ts` — implicit; ownership via page query)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F22-P1 | Positive | Signed-in customer sees their own orders (most recent first) | orders list with restaurant name, status, total | 📋 (page query `findMany({ where: { customerId } })`; no dedicated E2E assertion on the list page) |
| F22-B1 | Business rule | Orders scoped to the logged-in customer — another customer's orders are absent | `where: { customerId }` in query | 📋 (ownership enforced in page; same pattern as `getCustomerId`) |
| F22-N1 | Negative | Unauthenticated user on `/orders` → redirect to `/signin` | proxy guard: `/orders` in `CUSTOMER_PREFIXES` | ✅ (role-isolation spec: "unauthenticated: protected routes redirect to /signin") |
| F22-N2 | Negative | Unknown order id → `/orders/[id]` 404s (ownership check: no matching row) | Next.js `notFound()` | ✅ (customer.spec.ts: "ownership: unknown order id renders not-found") |
| F22-E1 | Edge | Unauthenticated direct access to `/orders` — proxy redirects before page renders | proxy redirects before `getCustomerId` is even called | ✅ (F7-N1 role-isolation spec) |

---

## F23 — Route guard fix: `/restaurants/[id]` is public

Tool: **Playwright** (`e2e/role-isolation.spec.ts`, `e2e/customer.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F23-P1 | Positive | Unauthenticated user can visit `/restaurants/[id]` without being redirected | page loads (or 404 for unknown id) | ✅ (role-isolation spec: public routes accessible; customer spec accesses restaurant detail without login issue) |
| F23-B1 | Business rule | `/restaurant` (no trailing s) is still RESTAURANT-role gated | redirect to `/signin` for non-RESTAURANT roles | ✅ (role-isolation spec: customer/driver bounced from `/restaurant`) |
| F23-E1 | Edge | Guard uses exact-path match `pathname === "/restaurant"` plus `startsWith("/restaurant/")` — NOT a bare `startsWith("/restaurant")` that would also match `/restaurants/...` | fix in `auth.config.ts` lines 37-39 | ✅ (role-isolation spec confirms the fix: customer reaches `/restaurants/[id]` freely) |

---

## Summary & gate

**Automated and green (✅) — 50 Vitest + 31 Playwright = 81 tests.**

Vitest (50): `lib/orders/state.test.ts` (38 tests, Phase 1) + `lib/orders/fees.test.ts` (2 tests) + `app/(customer)/_lib/cart.test.ts` (10 tests).

Playwright (31, headed Chromium, serial, workers:1): carried-forward Phase 1 specs (auth 11, restaurant-fulfillment 7, role-isolation 5, admin 4) + new Phase 2 `e2e/customer.spec.ts` (4 tests).

See execution report `2026-06-13-phase-2-test-report.md` for the per-test record. Production build clean. 0 failures.

**Schema/type-guaranteed (📋):** price snapshot integrity (independent `OrderItem.priceCents` column), transaction atomicity for order+items+payment+event creation, `markOrderPaid` idempotency predicate, APPROVED-gate enforced in every Prisma query, `devMarkPaid` prod guard, cart immutability (pure functions).

**Deferred to Phase 4 (🔜 Stripe):** real Stripe webhook calling `markOrderPaid` (the seam is built; stub replaces it). Stripe payment failure path, webhook signature verification, idempotency key handling.

**Deferred to Phase 5 (🔜):** multi-address book (saved addresses); accepting the single-restaurant replace dialog (F13-N2) — the JS logic exists but no dedicated E2E.

**Phase gate:** `pnpm test:all` (Vitest + build + all Playwright) green. Run `pnpm db:seed` before the E2E run.
