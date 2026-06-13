# Phase 1 — Test Cases (lifecycle + driver schema + actor authz)

> **Scope:** every feature implemented in Phase 1 (commits `c84ef75 → 72081ca`). Positive, negative, and edge cases across validation, business rules, permissions, error handling, action/route behavior, and data integrity. A Phase 1 feature is "done" only when its cases here are documented and the **scriptable-now** ones are green in `pnpm test:all`.
>
> **Tooling (test pyramid):** pure logic → **Vitest** (`lib/**/*.test.ts`); user-facing flows + permissions → **Playwright** (`e2e/<flow>.spec.ts`). Server Actions are RPC (not HTTP), so they're exercised through the real UI in Playwright.
>
> **Status legend:**
> - ✅ **automated** — script exists and passes today
> - ⏳ **to-write** — scriptable now in this phase
> - 🔜 **Phase 3** — documented now; script deferred because the driver claim/deliver **UI doesn't exist yet** (can't drive a non-existent screen). Underlying logic gets Vitest coverage when built.
> - 📋 **schema/type-guaranteed** — enforced by Prisma schema / TypeScript exhaustiveness / the build; no separate runtime test needed (noted for completeness).
>
> **Determinism:** all E2E rely on `pnpm db:seed` (self-restoring fixtures); no fixed sleeps — wait on text/elements. Seeded accounts (`password123`): `admin@`, `owner@` (owns APPROVED "Mario's Pizza"), `customer@`, `driver@` (APPROVED). Seed guarantees one PAID `PLACED` and one PAID unclaimed `READY` order.

---

## F1 — Order state machine: graph legality (`lib/orders/state.ts`)

Tool: **Vitest** · File: `lib/orders/state.test.ts` · **✅ automated (38 tests)**

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F1-P1 | Positive | Each legal edge: PLACED→ACCEPTED/REJECTED/CANCELLED, ACCEPTED→PREPARING, PREPARING→READY, READY→OUT_FOR_DELIVERY, OUT_FOR_DELIVERY→DELIVERED | `canTransition`=true; `assertTransition` no throw | ✅ |
| F1-P2 | Positive | `nextStatuses(PLACED)` = {ACCEPTED,REJECTED,CANCELLED}; `nextStatuses(PREPARING)` = [READY]; `nextStatuses(READY)` = [OUT_FOR_DELIVERY] | exact arrays | ✅ |
| F1-P3 | Positive | `isTerminal` true for DELIVERED/REJECTED/CANCELLED; false for PLACED/ACCEPTED/PREPARING/READY/OUT_FOR_DELIVERY | correct booleans | ✅ |
| F1-N1 | Negative | Illegal jump PLACED→DELIVERED (skips middle) | throws `IllegalTransitionError` | ✅ |
| F1-N2 | Negative | PREPARING→OUT_FOR_DELIVERY (skips READY — newly illegal in Phase 1) | throws `IllegalTransitionError` | ✅ |
| F1-N3 | Negative | READY→DELIVERED (skips OUT_FOR_DELIVERY) | throws | ✅ |
| F1-N4 | Negative | Backward moves (PREPARING→ACCEPTED, OUT_FOR_DELIVERY→PREPARING), ACCEPTED→READY | throws | ✅ |
| F1-N5 | Negative | Any transition out of a terminal state (DELIVERED→PLACED, etc.) | throws | ✅ |
| F1-E1 | Edge | ACCEPTED→CANCELLED (cancel only allowed pre-acceptance, i.e. from PLACED) | illegal → throws | ✅ |
| F1-E2 | Edge | Exhaustiveness: adding a new `OrderStatus` without updating `TRANSITIONS` | TS compile error (`Record<OrderStatus>`) | 📋 |

---

## F2 — Actor authorization: who may fire each transition (`lib/orders/state.ts`)

Tool: **Vitest** · File: `lib/orders/state.test.ts` · **✅ automated**

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F2-P1 | Positive | RESTAURANT fires PLACED→ACCEPTED/REJECTED, ACCEPTED→PREPARING, PREPARING→READY | no throw | ✅ |
| F2-P2 | Positive | DRIVER fires READY→OUT_FOR_DELIVERY, OUT_FOR_DELIVERY→DELIVERED | no throw | ✅ |
| F2-P3 | Positive | CUSTOMER fires PLACED→CANCELLED | no throw | ✅ |
| F2-P4 | Positive | ADMIN allowed on **every** legal edge (override) | no throw | ✅ |
| F2-N1 | Negative | RESTAURANT attempts READY→OUT_FOR_DELIVERY or OUT_FOR_DELIVERY→DELIVERED (driver-only leg) | throws `UnauthorizedActorError` | ✅ |
| F2-N2 | Negative | DRIVER attempts a kitchen leg (PREPARING→READY) | throws `UnauthorizedActorError` | ✅ |
| F2-N3 | Negative | CUSTOMER attempts PLACED→ACCEPTED | throws `UnauthorizedActorError` | ✅ |
| F2-E1 | Edge | Graph-illegal beats actor: ADMIN attempts PLACED→DELIVERED | throws `IllegalTransitionError` (graph check first), **not** actor error | ✅ |
| F2-E2 | Edge | `assertTransition(from,to)` with **no actor** (back-compat) | graph-only check, no actor enforcement | ✅ |
| F2-E3 | Edge | Unknown actor key / edge not in `TRANSITION_ACTORS` | `canActorTransition` = false (empty-set default) | ✅ |

---

## F3 — Restaurant order transitions (`app/(restaurant)/restaurant/orders/[id]/actions.ts`)

Tool: **Playwright** (`e2e/restaurant-fulfillment.spec.ts`) + logic via F1/F2 Vitest

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F3-P1 | Positive | Owner opens a PAID PLACED order → Accept → Start preparing → Mark ready | status badge advances Placed→Accepted→Preparing→Ready | ✅ (restaurant.spec.ts) |
| F3-P2 | Positive | At READY the restaurant has no further buttons | "No further actions for this order." shown | ✅ |
| F3-P3 | Positive | Reject a PLACED order | status → Rejected; terminal (no further actions) | ⏳ |
| F3-B1 | Business rule | Restaurant cannot mark OUT_FOR_DELIVERY/DELIVERED — those buttons never render; action would throw `UnauthorizedActorError` | no delivery buttons at any restaurant-reachable state | ✅ (UI) / 📋 (action enforced via F2-N1) |
| F3-B2 | Business rule | Every successful transition appends an `OrderStatusEvent {from,to,byUserId}` in the same `$transaction` | event row written; visible in admin order/customer timeline | ⏳ (verify via admin order detail or DB) |
| F3-PERM1 | Permission | Cross-tenant: owner A opens owner B's order id (`/restaurant/orders/<foreign-id>`) | 404 ("Order not found") — query scoped by `restaurantId` | ⏳ |
| F3-PERM2 | Permission | A restaurant user with **no** restaurant row calls the action | throws "No restaurant for this account" (`requireOwnedRestaurant`) | ⏳ (or 📋) |
| F3-PERM3 | Permission | Non-RESTAURANT role hits `/restaurant/...` | bounced by proxy → /signin (see F7) | ✅/⏳ |
| F3-N1 | Negative | Action on a non-existent order id | throws "Order not found" | ⏳ |
| F3-E1 | Edge | Double-advance race: two rapid Accept clicks on the same PLACED order | second is an illegal PLACED-from-ACCEPTED transition → throws; no duplicate event | ⏳ |
| F3-E2 | Edge | Advancing an order whose payment is not PAID | order isn't in the queue to open (see F4); direct id still ownership-checked | 📋 |

---

## F4 — Restaurant queue: payment gate + grouping (`app/(restaurant)/_lib/queue.ts`)

Tool: **Playwright** (`e2e/restaurant-fulfillment.spec.ts`) + targeted check

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F4-P1 | Positive | PAID orders grouped: New=[PLACED], Ready=[READY], In progress=[ACCEPTED,PREPARING,OUT_FOR_DELIVERY], Completed=[DELIVERED,REJECTED,CANCELLED] | correct columns | ⏳ (New + Ready visible today; assert grouping) |
| F4-P2 | Positive | A READY order appears under "Ready · awaiting driver", not "In progress" | Ready column populated | ⏳ |
| F4-B1 | Business rule | **Payment gate**: a `PLACED` order with `Payment.status=PENDING` never appears in the queue | absent from all columns | ⏳ (needs an unpaid-order fixture) |
| F4-B2 | Business rule | Queue scoped to caller's own restaurant only | no other restaurant's orders | ⏳ |
| F4-E1 | Edge | Order with no payment row at all | excluded (gate requires `payment.status=PAID`) | 📋 |
| F4-E2 | Edge | `itemCount` = sum of item quantities (not row count) | correct count for multi-qty items | ⏳ (or Vitest if grouping extracted) |

---

## F5 — Auth: sign-in (`app/(auth)/actions.ts` `signInAction`)

Tool: **Playwright** (`e2e/auth.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F5-P1 | Positive | Customer valid creds | lands `/browse`; header shows email | ✅ |
| F5-P2 | Positive | Admin valid creds → `/admin`; can sign out → `/` | redirect + signout | ✅ |
| F5-P3 | Positive | Restaurant valid creds → `/restaurant` | redirect | ⏳ (implicit in restaurant.spec sign-in; add explicit) |
| F5-P4 | Positive | Driver valid creds → `/driver` | redirect (note: `/driver` page is Phase 3 — asserts redirect target, not page content) | ⏳/🔜 |
| F5-N1 | Negative | Wrong password | "Invalid email or password"; stays on /signin | ✅ |
| F5-N2 | Negative | Unknown email | "Invalid email or password" | ⏳ |
| F5-N3 | Validation | Empty email or password (Zod `min(1)`) | "Email and password are required" | ⏳ |
| F5-E1 | Edge | Successful auth but user row not found at redirect lookup | redirect to `/` (fallback) | 📋 |

---

## F6 — Auth: sign-up (`app/(auth)/actions.ts` `signUpAction`)

Tool: **Playwright** (`e2e/auth.spec.ts`)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F6-P1 | Positive | Sign up CUSTOMER | user created; auto-signed-in; → `/browse` | ⏳ |
| F6-P2 | Positive | Sign up RESTAURANT | user created (no Restaurant row — built on onboarding); → `/restaurant` | ⏳ |
| F6-P3 | Positive | **Sign up DRIVER** | User + a `Driver` row `status=PENDING` created **atomically**; → `/driver` | ⏳ |
| F6-B1 | Business rule | Driver `Driver` row defaults to PENDING (cannot claim until APPROVED — enforced Phase 3) | `status=PENDING` | ⏳ (verify via admin Drivers list — Phase 3) / 📋 now |
| F6-DATA1 | Data integrity | If `driver.create` failed, no orphaned User (wrapped in `$transaction`) | both rows or neither | 📋 (transaction) / hard to trigger in E2E |
| F6-N1 | Validation | Name empty | "Name is required" | ⏳ |
| F6-N2 | Validation | Invalid email format | "Enter a valid email" | ⏳ |
| F6-N3 | Validation | Password < 8 chars | "Password must be at least 8 characters" | ⏳ |
| F6-N4 | Negative | Duplicate email (already exists) | "An account with this email already exists"; no second user | ⏳ |
| F6-N5 | Validation | Role not in {CUSTOMER,RESTAURANT,DRIVER} (tampered form) | Zod rejects → "Invalid details" | ⏳ |
| F6-E1 | Edge | Email uniqueness is case-/whitespace-sensitive as stored | duplicate check uses exact email | 📋 |

---

## F7 — Route guards / role isolation (`auth.config.ts` `authorized`)

Tool: **Playwright** · File: `e2e/role-isolation.spec.ts` (**NEW**) — highest-value negative coverage

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F7-P1 | Positive | Each role reaches its own area (admin→/admin, restaurant→/restaurant, driver→/driver*, customer→/browse) | allowed | partial ✅ / ⏳ |
| F7-N1 | Permission | Unauthenticated → `/admin`, `/restaurant`, `/driver`, `/orders`, `/checkout`, `/cart`, `/account` | redirected to `/signin` | ⏳ (only /admin ✅) |
| F7-N2 | Permission | Customer → `/admin` | bounced → /signin | ✅ |
| F7-N3 | Permission | Customer → `/restaurant` and `/driver` | bounced | ⏳ |
| F7-N4 | Permission | Restaurant → `/admin` and `/driver` | bounced | ⏳ |
| F7-N5 | Permission | Driver → `/admin` and `/restaurant` | bounced | ⏳ |
| F7-E1 | Edge | Public routes (`/`, `/browse`, `/signin`, `/signup`) reachable by anyone incl. unauth | allowed (no guard) | ⏳ |
| F7-E2 | Edge | `/driver` authorized for DRIVER role at the guard, but page is Phase 3 | guard passes (role check) — 404/empty until Phase 3 | 🔜 (page) / ⏳ (guard allows) |

> Note: the guard is **role-only** (layer 1). Ownership/tenant scoping is layer 2 — covered per-feature (F3-PERM1).

---

## F8 — Admin: restaurant approval + badges + order filter

Tool: **Playwright** (`e2e/admin.spec.ts`) + `parseStatus` logic

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F8-P1 | Positive | Admin suspends then approves "Mario's Pizza" | status badge SUSPENDED→APPROVED | ✅ |
| F8-P2 | Positive | Admin overview KPIs render (restaurants, pending, orders, today, test revenue) | cards show numbers | ⏳ |
| F8-P3 | Positive | Admin orders filter by status incl. **READY** | `?status=READY` filters table | ⏳ |
| F8-B1 | Business rule | Approving a PENDING restaurant makes it customer-visible (APPROVED gate) | visibility flips | 🔜 (needs customer discovery — Phase 2) |
| F8-N1 | Negative/edge | `?status=` with a bogus value (`parseStatus` uses `raw in OrderStatus`) | falls back to "All" (undefined filter), no crash | ⏳ |
| F8-E1 | Edge | READY/DRIVER badge tones render (not gray fallback) | teal/colored pills | ⏳ (visual; low priority) |

---

## F9 — Data model & integrity (`prisma/schema.prisma`, migration)

Tool: **Vitest/integration** where runtime-checkable; otherwise 📋 schema-guaranteed

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F9-DATA1 | Data integrity | `Driver.userId` unique — one Driver per user | duplicate driver.create for same user → DB unique error | 📋 / ⏳ (integration) |
| F9-DATA2 | Data integrity | `Order.driverId` nullable; defaults null on create | null until claimed | ✅ (seed creates READY w/ driverId=null) / 📋 |
| F9-DATA3 | Data integrity | FK `Order.driverId → Driver` is `ON DELETE SET NULL` | deleting a driver nulls driverId, doesn't delete orders | 📋 / ⏳ (integration) |
| F9-DATA4 | Data integrity | Price/name **snapshot** on `OrderItem`; `Order.subtotal/deliveryFee/total/addressLine` snapshot | later menu/fee edits don't change past orders | ⏳ (verify order detail shows snapshot after menu price change) |
| F9-DATA5 | Business rule | Money is integer cents; `totalCents = subtotalCents + deliveryFeeCents` | exact integer math, no floats | ✅ (seed) / ⏳ (assert in order detail) |
| F9-DATA6 | Data integrity | `OrderStatusEvent.from` nullable (initial PLACED event has from=null) | append-only audit trail | ✅ (seed) / 📋 |
| F9-E1 | Edge | New enum value (READY/DRIVER) appended to PG enum type | string-value lookups unaffected by ordinal position | 📋 (verified: app uses string values) |

---

## F10 — Seed determinism (`prisma/seed.ts`)

Tool: **Bash/manual** (run twice)

| # | Type | Scenario | Expected | Status |
|---|---|---|---|---|
| F10-P1 | Positive | `pnpm db:seed` creates admin/owner+restaurant+menu/customer/approved-driver + PAID PLACED + PAID READY | all present | ✅ (verified in Phase 1) |
| F10-B1 | Idempotency | Run seed twice | no duplicate orders/users; "ensure exists" guards hold | ✅ |
| F10-E1 | Edge | After E2E consumes the PLACED order (→READY), re-seed | a fresh PAID PLACED order is restored (placedCount===0 guard) | ✅ |

---

## Summary & gate

**Automated & green (✅) — 65 tests (38 Vitest + 27 Playwright):** state machine + actor matrix; restaurant fulfillment-to-READY + reject + payment-gate + queue grouping + totals + non-existent-id 404 + cross-tenant; full role-isolation matrix; auth sign-in/sign-up (incl. driver) + duplicate email; admin approve/suspend + KPIs + READY filter + bogus-status fallback. See the execution report `2026-06-13-phase-1-test-report.md` for the per-test record. **The per-row Status columns above reflect the original plan; the report is the authoritative current state.**

**Still open (⏳):** only **F3-B2** (assert `OrderStatusEvent` appended per transition) — no UI renders an event timeline until Phase 2; covered then or via a DB integration test.

**Deferred to Phase 3 (🔜) — UI not built:** driver claim → OUT_FOR_DELIVERY → DELIVERED, atomic-claim race ("already claimed"), PENDING/SUSPENDED driver cannot claim, earnings tally, customer-visibility-after-approval (also needs Phase 2 discovery). These are documented here so they're tracked, not forgotten.

**Schema/type-guaranteed (📋):** enum exhaustiveness, transaction atomicity, FK behavior — enforced by Prisma/TS/build.

**Phase gate:** `pnpm test:all` (Vitest + build + all Playwright) green, with the ⏳ items implemented. Run `pnpm db:seed` before the E2E run (self-restoring fixtures).
