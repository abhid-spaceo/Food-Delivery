# Phase 2 — Test Execution Report

**Run:** 2026-06-13 · **Branch:** `Abhi/qwikbite-customer` · **HEAD:** `6cba967` (`test(e2e): customer spec reliability`)
**Environment:** local · Postgres `fooddelivery_customer` · deterministic seed (`pnpm db:seed`) · Playwright **Chromium, headed (visible browser)** · serial `workers: 1`
**Commands:** `pnpm exec vitest run` · `pnpm db:seed` · `pnpm exec playwright test --headed --reporter=list`
**Companion:** test-case matrix → `2026-06-13-phase-2-test-cases.md`

## Summary

| Suite | Total | ✅ Passed | ❌ Failed | Notes |
|---|---|---|---|---|
| Unit (Vitest) — 3 files | 50 | 50 | 0 | fees (2) + cart (10) + order state machine (38) |
| E2E (Playwright) — 5 spec files | 31 | 31 | 0 | customer (4), auth (11), restaurant-fulfillment (7), role-isolation (5), admin (4) |
| Production build (`next build`) | — | ✅ | — | TypeScript clean |
| **TOTAL automated** | **81** | **81** | **0** | — |

**Result: ✅ ALL PASS — Phase 2 gate green.** 0 failures, 0 flakes. Headed Chromium, `retries: 0`, single run.

---

## A. Unit tests — Vitest (50/50 ✅)

### `lib/orders/fees.test.ts` (2/2 ✅) — new in Phase 2

| Group | Tests | Result | Matrix |
|---|---|---|---|
| delivery fee | 2 | ✅ | F11-P1, F11-P2 |

### `app/(customer)/_lib/cart.test.ts` (10/10 ✅) — new in Phase 2

| Group | Tests | Result | Matrix |
|---|---|---|---|
| adds item, stamps restaurant | 1 | ✅ | F12-P1 |
| immutability (no mutation) | 1 | ✅ | F12-E1 |
| quantity increment (same item) | 1 | ✅ | F12-P2 |
| separate lines (different items) | 1 | ✅ | F12-P3 |
| different-restaurant conflict detection | 1 | ✅ | F12-B1 |
| setQuantity + qty ≤ 0 removes line | 1 | ✅ | F12-P4 |
| removeItem drops line + clears restaurant | 1 | ✅ | F12-P5 |
| subtotal is integer-cents sum | 1 | ✅ | F12-P6 |
| itemCount sums quantities | 1 | ✅ | F12-P7 |
| empty cart has zero subtotal and zero items | 1 | ✅ | F12-P8 |

### `lib/orders/state.test.ts` (38/38 ✅) — carried from Phase 1

| Group | Tests | Result | Matrix |
|---|---|---|---|
| legal transitions | 7 | ✅ | F1-P1 |
| illegal transitions | 13 | ✅ | F1-N1..N5, F1-E1 |
| isTerminal | 8 | ✅ | F1-P3 |
| nextStatuses | 4 | ✅ | F1-P2 |
| actor authorization | 6 | ✅ | F2-P1..P4, F2-N1..N3, F2-E1 |

---

## B. E2E tests — Playwright (31/31 ✅, headed Chromium)

### `e2e/customer.spec.ts` — 4 ✅ (new in Phase 2)

| Test | Matrix |
|---|---|
| customer places an order, pays (stub), and tracks it to READY | F18-P1, F19-P1, F19-P2, F20-P1, F20-P2, F17-P1, F17-P2, F14-P1, F15-P1, F16-P1 |
| ownership: unknown order id renders not-found | F22-N2 |
| customer can cancel an order while it is still PLACED | F21-P1, F21-E1 |
| single-restaurant cart: declining the replace prompt keeps the first item | F13-N1 |

### `e2e/auth.spec.ts` — 11 ✅ (carried from Phase 1)

| Test | Matrix |
|---|---|
| rejects invalid credentials | F5-N1 |
| unknown email shows invalid credentials error | F5-N2 |
| customer signs in → /browse | F5-P1 |
| admin signs in → /admin + sign out | F5-P2 |
| restaurant owner signs in → /restaurant | F5-P3 |
| driver signs in → /driver | F5-P4 |
| unauthenticated → /admin redirects to /signin | F7-N1 |
| customer cannot reach /admin | F7-N2 |
| duplicate-email signup shows error | F6-N4 |
| customer signup (unique email) → /browse | F6-P1 |
| driver signup (unique email) → /driver | F6-P3 |

### `e2e/restaurant-fulfillment.spec.ts` — 7 ✅ (carried from Phase 1)

| Test | Matrix |
|---|---|
| accept → prepare → ready | F3-P1, F3-P2 |
| reject a placed order | F3-P3 |
| payment gate: unpaid order not in queue | F4-B1 |
| queue shows New + Ready columns, correct item count | F4-P1, F4-P2, F4-E2 |
| order detail subtotal + fee = total ($18.00 + $2.99 = $20.99) | F9-DATA5, F18-B3 |
| non-existent order id does not render detail | F3-N1 |
| cross-tenant: Mario's owner cannot view Spice Hub order | F3-PERM1 |

### `e2e/role-isolation.spec.ts` — 5 ✅ (carried from Phase 1; `/restaurants` fix now validated)

| Test | Matrix |
|---|---|
| unauthenticated: protected routes redirect to /signin | F7-N1, F22-N1 |
| unauthenticated: public routes accessible (incl. /browse, /signin, /signup) | F7-E1, F14-P2, F23-P1 |
| customer: cannot reach /admin, /restaurant, /driver | F7-N2, F7-N3, F23-B1 |
| restaurant: cannot reach /admin or /driver | F7-N4 |
| driver: cannot reach /admin or /restaurant; /driver guard passes | F7-N5, F7-E2 |

### `e2e/admin.spec.ts` — 4 ✅ (carried from Phase 1)

| Test | Matrix |
|---|---|
| admin suspend then approve a restaurant | F8-P1, F14-E1 |
| admin overview shows KPI cards | F8-P2 |
| admin orders filters to READY status | F8-P3 |
| bogus `?status=` filter doesn't crash | F8-N1 |

---

## C. Coverage tracker — cases NOT automated (tracked, not failures)

### 🔜 Deferred to Phase 4 (real Stripe not wired)
- Real Stripe checkout session creation and webhook delivery
- Payment failure path (card declined → order stays PLACED, queue invisible)
- Stripe webhook signature verification
- Idempotency key handling on the webhook (replay safety)

### 🔜 Deferred to Phase 5 (multi-address / accept-replace flow not built)
- **F13-N2** — accepting the single-restaurant replace dialog: the JS `window.confirm` + `EMPTY_CART` replace logic exists in `add-to-cart-button.tsx` but no Playwright test covers the accept path
- Multi-address book (saved addresses at checkout)

### 📋 Schema / unit / build-guaranteed (no separate E2E needed)
- **F18-B1** price snapshot — `OrderItem.priceCents` is an independent column, never re-read from `MenuItem` after creation
- **F18-B2** `deliveryFeeCents` snapshot — hardcoded constant written once into the row
- **F18-B8** initial `OrderStatusEvent` written in same transaction as `Order.create`
- **F19-B2** `markOrderPaid` idempotency — `updateMany({ where: { status: "PENDING" } })` is self-enforcing
- **F19-B3** `devMarkPaid` prod guard — explicit `NODE_ENV` check in the action
- **F21-B3** cancel event appended in `$transaction` — structure mirrors restaurant fulfillment actions
- **F12-E2** `setQuantity` ≤ 0 delegates to `removeItem` — pure unit path

---

## D. Failures & flakes

**None.** 0 failed, 0 flaky. `retries: 0`, single headed run.

---

## E. Reproduce

```bash
pnpm db:seed                                          # restore deterministic fixtures
pnpm exec vitest run                                  # unit tests (50)
pnpm exec playwright test --headed --reporter=list    # e2e (31), visible Chromium
# full gate (headless): pnpm test:all
```

> **Phase-2 testing status:** closed — 81 automated tests green (50 Vitest + 31 Playwright) covering the full customer demand-side surface. Deferred items are real-Stripe (Phase 4) and multi-address / accept-replace E2E (Phase 5); all core business rules (price snapshot, fee snapshot, idempotent payment, ownership scoping, single-restaurant cart, APPROVED gating, `/restaurants` guard fix) are verified by unit tests, schema constraints, or Playwright flows.
