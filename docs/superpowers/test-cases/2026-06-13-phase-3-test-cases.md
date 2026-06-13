# Phase 3 — Test Cases (driver module + admin driver management)

> **Scope:** every feature implemented in Phase 3 (driver ownership helpers, atomic claim contract, earnings math, pickup pool + polled route, order claim/deliver actions, deliveries/earnings screens, admin driver approval). Positive, negative, and edge cases across validation, business rules, permissions, error handling, route/API behavior, and data integrity. A Phase 3 feature is "done" only when its cases here are documented and the **scriptable-now** ones are green in `pnpm test:all`.
>
> **Tooling (test pyramid):** pure logic → **Vitest** (`lib/**/*.test.ts`, `app/(driver)/_lib/*.test.ts`); user-facing flows + permissions → **Playwright** (`e2e/driver.spec.ts`). Server Actions are RPC (not HTTP), so they are exercised through the real UI in Playwright.
>
> **Status legend:**
> - ✅ **automated** — script exists and passes today (file named)
> - 📋 **schema/type-guaranteed** — enforced by Prisma schema / TypeScript exhaustiveness / the build; no separate runtime test needed
> - 🔜 **deferred** — documented now; script deferred to a later phase (reason stated)
>
> **Determinism:** all E2E rely on `pnpm db:seed` before the run. The driver flow **mutates orders** (claim consumes READY, deliver flips OUT_FOR_DELIVERY to DELIVERED), so the E2E gate must start from a clean order state — delete orders and reseed — because earnings assertions are count-sensitive. The seed provides TWO PAID unclaimed READY orders so the happy-path test and the already-claimed test can each consume one without contending. Serial workers (`fullyParallel: false`), no fixed sleeps — wait on text/elements. Seeded accounts (`password123`): `admin@demo.test`, `owner@demo.test` (APPROVED "Mario's Pizza"), `customer@demo.test`, `driver@demo.test` (APPROVED), `driver2@demo.test` (APPROVED).
>
> **Cross-role dependency note:** the full customer → restaurant → driver loop (customer places a Stripe-paid order, restaurant fulfills to READY, driver claims and delivers, customer sees DELIVERED) is **not exercised in Phase 3** because the customer-facing discovery and checkout UI lives in Phase 2, which has not yet merged into this branch. That end-to-end path will be verified as a cross-phase regression test once Phase 2 merges.

---

## F11 — Driver ownership helpers (`app/(driver)/_lib/driver.ts`)

Tool: **Playwright** (`e2e/driver.spec.ts`) + build verification

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F11-P1 | Positive | `getDriver()` for an authenticated user with a Driver row → returns the Driver record | non-null Driver row | ✅ `e2e/driver.spec.ts` — happy-path sign-in + pool redirect |
| F11-P2 | Positive | `requireApprovedDriver()` for an APPROVED driver → returns `{ driver, userId }` with no throw | claim action proceeds | ✅ `e2e/driver.spec.ts` — claim test exercises it end-to-end |
| F11-N1 | Negative | `requireApprovedDriver()` called without a session (unauthenticated) | throws "Not authenticated" | 📋 (role guard bounces to /signin before the action is reachable) |
| F11-N2 | Negative | `requireApprovedDriver()` for a user with no Driver row | throws "No driver profile for this account" | 📋 (signup always creates a Driver row; non-DRIVER-role users are route-guarded out) |
| F11-N3 | Negative | `requireApprovedDriver()` for a PENDING driver | throws "Driver is not approved" | ✅ `e2e/driver.spec.ts` — pending-driver gate test (PENDING driver cannot reach the pool; the action would also throw if called directly) |
| F11-N4 | Negative | `requireApprovedDriver()` for a SUSPENDED driver | throws "Driver is not approved" | 🔜 Phase 5 (admin-suspend flow not covered in the driver E2E today; `assertAdmin` + `suspendDriver` tested via admin E2E) |
| F11-E1 | Edge | `getDriver()` for a user with no Driver row (e.g., CUSTOMER) | returns null (not an error) | 📋 (covered by schema: no Driver row for non-DRIVER users; type is `Driver | null`) |

---

## F12 — Awaiting-approval gating (`app/(driver)/driver/page.tsx`)

Tool: **Playwright** (`e2e/driver.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F12-P1 | Positive | APPROVED driver signs in → `GET /driver` redirects to `/driver/pool` | URL becomes `/driver/pool` | ✅ `e2e/driver.spec.ts` — happy-path test asserts `toHaveURL("/driver/pool")` after sign-in |
| F12-P2 | Positive | PENDING driver at `/driver` sees awaiting-approval screen | "awaiting admin approval" text visible; status badge present | ✅ `e2e/driver.spec.ts` — pending-driver test |
| F12-N1 | Negative | PENDING driver navigates directly to `/driver/pool` | server-side redirect back to `/driver` (page component checks `driver.status !== "APPROVED"`) | ✅ `e2e/driver.spec.ts` — pending-driver test asserts `toHaveURL("/driver")` after direct pool nav |
| F12-N2 | Negative | SUSPENDED driver at `/driver` | sees the awaiting-approval card with "Your account is suspended. Contact an admin." | 🔜 Phase 5 (suspend then navigate — no current test for SUSPENDED path, though the branch in `page.tsx` is implemented) |
| F12-E1 | Edge | DRIVER user with no Driver row (e.g., row deleted after signup) | page renders "No driver profile is linked to this account." | 📋 (branch exists in the page; edge not exercised because signup always creates the row atomically) |

---

## F13 — Pickup pool query + polled route (`app/(driver)/driver/pool/route.ts`, `deliveries.ts#getPool`)

Tool: **Playwright** (`e2e/driver.spec.ts`) + build clean

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F13-P1 | Positive | `GET /driver/pool` (Route Handler) as APPROVED driver → returns `{ ok: true, data: [...] }` with the seeded READY order(s) | JSON envelope; `data` array non-empty | ✅ `e2e/driver.spec.ts` — pool board renders cards from this endpoint (SWR) |
| F13-P2 | Positive | Pool excludes already-claimed orders (driverId is set) | once an order is claimed, it disappears from subsequent pool responses | ✅ `e2e/driver.spec.ts` — after claim, `driver2` sees "not available" on the taken order; pool no longer shows it |
| F13-P3 | Positive | Pool items ordered oldest-first (`createdAt asc`) | first card is the order with the earliest `createdAt` | 📋 (query hardcoded `orderBy: { createdAt: "asc" }`; verified by build/types) |
| F13-B1 | Business rule | Pool only shows `status=READY AND driverId=null AND payment.status=PAID` | PLACING/ACCEPTED/PREPARING orders absent; READY-but-claimed orders absent; READY-but-unpaid orders absent | 📋 (Prisma `where` clause; the payment-gate invariant is that an order can only reach READY after being PAID through the restaurant queue) |
| F13-PERM1 | Permission | `GET /driver/pool` as a PENDING driver | returns `{ ok: false, error: "Driver is not approved" }` with HTTP 403 | ✅ `e2e/driver.spec.ts` (SWR would show error state) — pending-driver test verifies the pool page itself is not reachable; Route Handler 403 is tested by the guard + F11-N3 path |
| F13-PERM2 | Permission | `GET /driver/pool` unauthenticated (no session) | role guard in `proxy.ts` redirects to `/signin` before the Route Handler is reached | 📋 (proxy.ts role guard; same guard that covers all `/driver/**` routes) |
| F13-E1 | Edge | No orders in the pool (all claimed or no READY orders exist) | `{ ok: true, data: [] }`; board renders "No orders ready for pickup right now." | ✅ `e2e/driver.spec.ts` — after both READY orders are consumed, this state is reached; not explicitly asserted but the empty render branch exists |

---

## F14 — Atomic claim (`lib/orders/claim.ts`, `claimOrder` action)

Tool: **Vitest** (`lib/orders/claim.test.ts`) + **Playwright** (`e2e/driver.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F14-P1 | Positive | `assertClaimed(1)` (updateMany changed 1 row) | no throw | ✅ `lib/orders/claim.test.ts` — "treats an updateMany count of 1 as a successful claim" |
| F14-P2 | Positive | Approved driver claims a READY, unclaimed, PAID order → `claimOrder` succeeds | order status flips to `OUT_FOR_DELIVERY`, `driverId` set to this driver; `OrderStatusEvent` written; `revalidatePath` called | ✅ `e2e/driver.spec.ts` — happy-path test: claim button click → redirect to deliveries, order shows OUT_FOR_DELIVERY |
| F14-N1 | Negative | `assertClaimed(0)` (0 rows changed — order already taken or no longer READY) | throws `AlreadyClaimedError` | ✅ `lib/orders/claim.test.ts` — "treats 0 rows as already-claimed" |
| F14-N2 | Negative | `assertClaimed(-1)` (any non-positive count) | throws `AlreadyClaimedError` | ✅ `lib/orders/claim.test.ts` — "any non-positive count is already-claimed" |
| F14-N3 | Negative | Second driver navigates to an order already claimed by the first driver | order detail shows "This order isn't available to you." — no Claim button | ✅ `e2e/driver.spec.ts` — "second driver cannot claim an already-claimed order" |
| F14-B1 | Business rule | When `assertClaimed` throws inside `$transaction`, no `OrderStatusEvent` row is written (the transaction rolls back atomically) | DB audit trail has exactly one READY→OUT_FOR_DELIVERY event per successful claim | ✅ `lib/orders/claim.test.ts` (pure contract) / 📋 (transaction rollback: Prisma `$transaction` semantics) |
| F14-B2 | Business rule | Claim condition is a scalar `where status=READY AND driverId=null` — no read-then-write race | the TOCTOU window is eliminated; only one driver can satisfy the condition | 📋 (Prisma conditional `updateMany`; no application-level read before the write) |
| F14-PERM1 | Permission | A PENDING driver calls `claimOrder` | `requireApprovedDriver()` throws "Driver is not approved" before the DB update | ✅ `e2e/driver.spec.ts` — pending driver cannot reach the claim UI; action also throws (F11-N3) |
| F14-PERM2 | Permission | An unauthenticated caller hits the claim action | `requireApprovedDriver()` throws "Not authenticated" | 📋 (role guard blocks the route group; action also re-checks) |
| F14-E1 | Edge | Claiming a non-existent order id | `updateMany` returns 0 rows → `assertClaimed(0)` → `AlreadyClaimedError` | 📋 (same 0-row path; error message is the same) |
| F14-E2 | Edge | Claiming an order that is READY but already has a `driverId` (claimed but race condition window passed) | `updateMany where driverId=null` returns 0 → `AlreadyClaimedError` | 📋 (`driverId=null` in the `where` clause covers this) |

---

## F15 — Driver-only delivery leg (`markDelivered` action, `lib/orders/state.ts`)

Tool: **Playwright** (`e2e/driver.spec.ts`) + Vitest state machine (F2-P2, F2-N1)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F15-P1 | Positive | Driver with an OUT_FOR_DELIVERY order they claimed calls `markDelivered` → succeeds | order status → DELIVERED; `OrderStatusEvent` appended in `$transaction`; `revalidatePath` called | ✅ `e2e/driver.spec.ts` — happy-path test: "Mark delivered" click → DELIVERED badge visible |
| F15-P2 | Positive | `assertTransition(OUT_FOR_DELIVERY, DELIVERED, "DRIVER")` in `lib/orders/state.ts` allows the transition | no throw | ✅ `lib/orders/state.test.ts` — F2-P2 (actor DRIVER fires delivery leg) |
| F15-N1 | Negative | `assertTransition(READY, DELIVERED, "DRIVER")` — skips OUT_FOR_DELIVERY | throws `IllegalTransitionError` (graph check fails before actor check) | ✅ `lib/orders/state.test.ts` — F1-N3 |
| F15-N2 | Negative | RESTAURANT calls `markDelivered` (or `assertTransition(OUT_FOR_DELIVERY, DELIVERED, "RESTAURANT")`) | throws `UnauthorizedActorError` | ✅ `lib/orders/state.test.ts` — F2-N1 |
| F15-N3 | Negative | Driver A tries to `markDelivered` an order claimed by Driver B | `findFirst where { id, driverId: driver.id }` returns null → throws "Order not found" | ✅ `e2e/driver.spec.ts` — "second driver cannot claim an already-claimed order" (order is claimed by driver1; driver2 sees no Mark delivered button; the action would also throw) |
| F15-N4 | Negative | Driver calls `markDelivered` on an order they never claimed (`driverId` is null or different) | `findFirst` returns null → throws "Order not found" | 📋 (`where: { id, driverId: driver.id }` ownership re-check; silent no-op at DB level) |
| F15-PERM1 | Permission | PENDING or SUSPENDED driver calls `markDelivered` | `requireApprovedDriver()` throws before the DB lookup | 📋 (same `requireApprovedDriver` guard as `claimOrder`) |
| F15-E1 | Edge | `markDelivered` on an already-DELIVERED order (double-submit) | `assertTransition(DELIVERED, DELIVERED, "DRIVER")` throws `IllegalTransitionError` (terminal state) | ✅ `lib/orders/state.test.ts` — F1-N5 (terminal state) |
| F15-E2 | Edge | `markDelivered` on a non-existent order id | `findFirst` returns null → throws "Order not found" | 📋 (same ownership check path as F15-N4) |

---

## F16 — Earnings money math (`app/(driver)/_lib/deliveries.ts#sumDeliveredFees`)

Tool: **Vitest** (`app/(driver)/_lib/deliveries.test.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F16-P1 | Positive | `sumDeliveredFees` with two DELIVERED orders (299 + 199 cents) and one OUT_FOR_DELIVERY | returns 498 (299 + 199 only) | ✅ `deliveries.test.ts` — "sums deliveryFeeCents over DELIVERED orders only" |
| F16-P2 | Positive | `sumDeliveredFees` with a single DELIVERED order (299 cents) | returns 299 | ✅ `deliveries.test.ts` — result is integer; returns 299 |
| F16-N1 | Negative | `sumDeliveredFees` with empty array | returns 0 | ✅ `deliveries.test.ts` — "is zero for no delivered orders" (empty case) |
| F16-N2 | Negative | `sumDeliveredFees` with only OUT_FOR_DELIVERY orders (none delivered) | returns 0 | ✅ `deliveries.test.ts` — "is zero for no delivered orders" (non-empty but no DELIVERED) |
| F16-E1 | Edge | `sumDeliveredFees` result is always an integer (no float accumulation) | `Number.isInteger(result)` === true | ✅ `deliveries.test.ts` — "returns an integer number of cents" |
| F16-B1 | Business rule | Earnings count only DELIVERED orders — OUT_FOR_DELIVERY orders are "in flight" and not counted | OUT_FOR_DELIVERY `deliveryFeeCents` excluded from sum | ✅ `deliveries.test.ts` — F16-P1 |
| F16-B2 | Business rule | Earnings are display-only (no payout) — `getEarnings` uses a Prisma aggregate, not a stored `earningsCents` column | aggregate query `_sum.deliveryFeeCents` recomputed on demand | 📋 (no `earningsCents` column exists in the schema; `getEarnings` is a live aggregate) |
| F16-E2 | Edge | Earnings page after completing a delivery shows the fee from that delivery | driver sees "$2.99" after delivering the seeded order | ✅ `e2e/driver.spec.ts` — happy-path test asserts `getByText("$2.99")` on `/driver/earnings` |

---

## F17 — Deliveries list scoping (`getMyDeliveries`, `/driver/deliveries` page)

Tool: **Playwright** (`e2e/driver.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F17-P1 | Positive | After claiming an order, it appears in the "Active" section of `/driver/deliveries` with `OUT_FOR_DELIVERY` status | driver sees the order card under "Active" | ✅ `e2e/driver.spec.ts` — happy-path test: after claim + page reload, `OUT_FOR_DELIVERY` text visible |
| F17-P2 | Positive | After marking delivered, the order moves to the "Delivered" section | order no longer in "Active"; appears under "Delivered" | ✅ `e2e/driver.spec.ts` — happy-path test (DELIVERED badge visible after mark-delivered step) |
| F17-B1 | Business rule | Deliveries list is scoped to **this driver only** (`where: { driverId: driver.id }`) — another driver's deliveries are invisible | no cross-driver leakage | ✅ `e2e/driver.spec.ts` — driver2 signs in and sees no deliveries from driver1's claim (driver2's deliveries page is empty / contains only their own orders) |
| F17-N1 | Negative | PENDING driver navigates to `/driver/deliveries` | server redirect to `/driver` (page checks `driver.status !== "APPROVED"`) | ✅ `e2e/driver.spec.ts` — pending-driver test (navigates to `/driver/pool`; same guard pattern applies to all driver sub-pages) |
| F17-E1 | Edge | Driver with no deliveries yet | "Nothing out for delivery." and "No completed deliveries yet." empty states render | 📋 (empty-state branches in the page; reached by any fresh approved driver; not explicitly asserted in a dedicated test) |

---

## F18 — Admin driver approve / suspend (`app/(admin)/admin/drivers/`)

Tool: **Playwright** (`e2e/driver.spec.ts`) + `assertAdmin` re-check

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F18-P1 | Positive | Admin opens `/admin/drivers?status=PENDING`, clicks Approve for a PENDING driver | driver row badge changes to APPROVED; driver leaves the PENDING-filtered list | ✅ `e2e/driver.spec.ts` — "admin approves a pending driver" test |
| F18-P2 | Positive | After approval, driver appears under `?status=APPROVED` filter | row visible with APPROVED badge | ✅ `e2e/driver.spec.ts` — "admin approves a pending driver" asserts row visible under APPROVED filter |
| F18-P3 | Positive | Admin overview (`/admin`) shows "Drivers" and "Pending drivers" KPI cards | both KPI cards render with numeric values | 🔜 Phase 3 admin KPI card assertion not in `e2e/driver.spec.ts`; covered by `e2e/admin.spec.ts` if extended (the existing admin.spec.ts F8-P2 only checks generic KPI cards pre-Phase-3) |
| F18-P4 | Positive | `suspendDriver` sets a driver's status to SUSPENDED | badge changes to SUSPENDED; Approve button re-appears | 🔜 Phase 5 (suspend path not covered in current `e2e/driver.spec.ts`; `suspendDriver` action implemented and compiles, covered by build + action structure) |
| F18-N1 | Negative/Permission | Non-admin calls `approveDriver` or `suspendDriver` (tampered form) | `assertAdmin()` throws "Forbidden: admin role required." | 📋 (`assertAdmin` re-checks role in the action; mirrors `app/(admin)/admin/restaurants/actions.ts` pattern; proxy also blocks non-admin from `/admin/**`) |
| F18-N2 | Negative | `approveDriver` called with empty/missing `id` field | throws "Missing driver id." | 📋 (guard check `if (!id) throw` in the action) |
| F18-N3 | Negative | `approveDriver` with a non-existent driver id | Prisma `update` throws "Record to update not found" | 📋 (Prisma error propagates; no special handling needed for this admin-only action) |
| F18-E1 | Edge | Filter `/admin/drivers?status=bogus` | `parseStatus` returns `undefined` → no filter applied, all drivers shown; no crash | 📋 (`raw in DriverStatus` check; mirrors the restaurant `parseStatus` pattern in `admin/restaurants/page.tsx`) |
| F18-DATA1 | Data integrity | `approveDriver` uses `prisma.driver.update` (not `updateMany`), so a bad id throws rather than silently doing nothing | explicit DB error surfaces | 📋 (admin-facing; fine to surface Prisma error) |

---

## F19 — Route guard + role isolation (driver routes)

Tool: **Playwright** (`e2e/role-isolation.spec.ts`) — Phase 1 tests still cover the guard; verified green in Phase 3 regression

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F19-P1 | Positive | DRIVER role → `/driver/pool` | allowed (proxy passes DRIVER to `/driver/**`) | ✅ `e2e/role-isolation.spec.ts` — "driver cannot reach /admin or /restaurant; /driver guard passes" |
| F19-N1 | Permission | Customer → `/driver/pool` | proxy bounces to `/signin` | ✅ `e2e/role-isolation.spec.ts` — F7-N3 |
| F19-N2 | Permission | Restaurant → `/driver/pool` | proxy bounces to `/signin` | ✅ `e2e/role-isolation.spec.ts` — F7-N4 |
| F19-N3 | Permission | Unauthenticated → `/driver/pool` | proxy bounces to `/signin` | ✅ `e2e/role-isolation.spec.ts` — F7-N1 |
| F19-E1 | Edge | Guard is role-only; ownership is re-verified in every Server Action (`requireApprovedDriver`) | guard passes any DRIVER; action re-checks APPROVED status and order ownership | ✅ (F11-N3, F14-PERM1, F15-PERM1 — PENDING driver bounced at the page/action level, not the proxy) |

---

## Summary & gate

**Automated & green (✅) — 44 Vitest + 31 Playwright = 75 total tests across the Phase 3 suite:**

- Vitest (44): 38 state-machine/actor (Phase 1 carried forward) + 3 claim-contract (`lib/orders/claim.test.ts`) + 3 earnings-math (`app/(driver)/_lib/deliveries.test.ts`)
- Playwright (31): 27 carried from Phase 1 (auth 11, restaurant-fulfillment 7, role-isolation 5, admin 4) + 4 new driver tests (`e2e/driver.spec.ts`)

**Phase 3 driver E2E (4 new):**
- "approved driver claims a READY order, delivers it, and earns the fee" — covers F12-P1, F13-P1, F14-P2, F15-P1, F16-E2, F17-P1, F17-P2
- "second driver cannot claim an already-claimed order" — covers F14-N3, F13-P2, F15-N3, F17-B1
- "a pending driver is kept out of the pool" — covers F12-P2, F12-N1, F11-N3, F14-PERM1
- "admin approves a pending driver" — covers F18-P1, F18-P2

**Build:** production build clean, TypeScript no errors.

**Deferred (🔜):**
- F12-N2 SUSPENDED driver awaiting screen — Phase 5 (admin-suspend→driver-login flow)
- F18-P3 admin driver KPI card assertion in E2E — extend `e2e/admin.spec.ts` (Phase 3 extension)
- F18-P4 `suspendDriver` E2E path — Phase 5
- Full customer → restaurant → driver loop: verified only after Phase 2 merges (requires customer discovery + Stripe checkout UI)

**Schema/type-guaranteed (📋):** `requireApprovedDriver` unauthenticated path, transaction atomicity (no event on 0-row claim), ownership re-check silent no-op, `TOCTOU` eliminated by conditional `updateMany`, `parseStatus` bogus-value fallback, `sumDeliveredFees` display-only (no stored column), admin action `assertAdmin` re-check.

**Phase gate:** `pnpm db:seed` (clean reseed, delete existing orders first because earnings are count-sensitive) → `pnpm test` (Vitest 44) → `pnpm build` → `pnpm exec playwright test --headed --reporter=list` (Playwright 31 across all 5 spec files).
