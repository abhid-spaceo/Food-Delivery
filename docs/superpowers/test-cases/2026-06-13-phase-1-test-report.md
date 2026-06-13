# Phase 1 — Test Execution Report

**Run:** 2026-06-13 22:35 · **Branch:** `Abhi/qwikbite` · **HEAD:** `683c2a9` (test changes uncommitted on top)
**Environment:** local · Postgres `fooddelivery_dev` · deterministic seed (`pnpm db:seed`) · Playwright **Chromium, headed (visible browser)** · dev server auto-started
**Commands:** `pnpm exec vitest run` · `pnpm db:seed` · `pnpm exec playwright test --headed --reporter=list`
**Companion:** test-case matrix → `2026-06-13-phase-1-test-cases.md`

## Summary

| Suite | Total | ✅ Passed | ❌ Failed | Notes |
|---|---|---|---|---|
| Unit (Vitest) — `lib/orders/state.test.ts` | 38 | 38 | 0 | state machine + actor authz |
| E2E (Playwright) — 4 spec files | 27 | 27 | 0 | auth (11), restaurant-fulfillment (7), role-isolation (5), admin (4) |
| Production build (`next build`) | — | ✅ | — | TypeScript clean, 15 routes |
| **TOTAL automated** | **65** | **65** | **0** | — |

**Result: ✅ ALL PASS — Phase 1 gate green.** No failures, no flakes (single run, retries=0). Verified in a **headed Chromium** run.

---

## A. Unit tests — Vitest (38/38 ✅) — `lib/orders/state.test.ts`

| Group | Tests | Result | Matrix |
|---|---|---|---|
| legal transitions | 7 | ✅ | F1-P1 |
| illegal transitions | 13 | ✅ | F1-N1..N5, F1-E1 |
| isTerminal | 8 | ✅ | F1-P3 |
| nextStatuses | 4 | ✅ | F1-P2 |
| actor authorization | 6 | ✅ | F2-P1..P4, F2-N1..N3, F2-E1 |

## B. E2E tests — Playwright (27/27 ✅, headed Chromium)

### `e2e/auth.spec.ts` — 11 ✅
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
| driver signup (unique email) → /driver | F6-P3 (redirect; PENDING-row check → Phase 3) |

### `e2e/restaurant-fulfillment.spec.ts` — 7 ✅
| Test | Matrix |
|---|---|
| accept → prepare → ready | F3-P1, F3-P2 |
| reject a placed order | F3-P3 |
| payment gate: unpaid ($77.77) order not in queue | F4-B1 |
| **queue shows New + Ready columns, correct item count** | F4-P1, F4-P2, F4-E2 |
| **order detail subtotal + fee = total** ($18.00 + $2.99 = $20.99) | F9-DATA5 |
| **non-existent order id does not render detail** (no "Back to queue") | F3-N1 |
| cross-tenant: Mario's owner cannot view Spice Hub order | F3-PERM1 |

### `e2e/role-isolation.spec.ts` — 5 ✅
| Test | Matrix |
|---|---|
| unauthenticated: protected routes → /signin | F7-N1 |
| unauthenticated: public routes accessible | F7-E1 |
| customer cannot reach /admin, /restaurant, /driver | F7-N2, F7-N3 |
| restaurant cannot reach /admin or /driver | F7-N4 |
| driver cannot reach /admin or /restaurant; /driver guard passes | F7-N5, F7-E2 |

### `e2e/admin.spec.ts` — 4 ✅
| Test | Matrix |
|---|---|
| admin suspend then approve a restaurant | F8-P1 |
| **admin overview shows KPI cards** ("Total orders", "Pending approvals") | F8-P2 |
| **admin orders filters to READY status** | F8-P3 |
| **bogus `?status=` filter doesn't crash** (falls back to all) | F8-N1 |

### Manual / scripted checks
| Check | Result | Matrix |
|---|---|---|
| `pnpm db:seed` idempotent (run twice, no dup-key, counts stable) | ✅ | F10-P1, F10-B1, F10-E1 |

---

## C. Coverage tracker — cases NOT automated (tracked, not failures)

### 🔜 Deferred to Phase 3 (driver claim/deliver UI not built — cannot E2E yet)
- Driver claims READY → OUT_FOR_DELIVERY → DELIVERED
- Atomic-claim race: 2nd driver gets "already claimed"
- PENDING / SUSPENDED driver cannot claim
- Driver earnings tally
- Driver-signup creates a **PENDING** Driver row (verify via admin Drivers list)
- Restaurant becomes customer-visible after approval (also needs Phase 2 discovery)

### ⏳ Pending — 1 case (no UI surface to assert yet)
- **F3-B2** — assert an `OrderStatusEvent` is appended per transition. No current screen renders the event timeline (the customer tracking timeline arrives in **Phase 2**). Will be covered then, or via a DB-level integration test. *(The append logic itself runs inside the action's `$transaction`; the seed relies on it for the READY order's event trail.)*

### 📋 Schema / unit / build-guaranteed (no separate E2E)
- F1-E2 enum exhaustiveness (TS) · F2-E2/E3 actor back-compat (unit) · F3-E1 double-advance race (state machine has no ACCEPTED→ACCEPTED edge; UI replaces the button after the first click — covered by unit + UI) · F6-N1/N2/N3 signup field validation (HTML `required`/`minLength`, client-enforced) · F6-DATA1 signup atomicity (`$transaction`) · F9-DATA1/DATA3 unique/FK (Prisma constraints) · **F9-DATA4 price snapshot survives menu edits** (schema-guaranteed: `OrderItem.priceCents` is an independent column, never re-read from `MenuItem`) · F9-E1 enum ordinal-independence

---

## D. Failures & flakes

**None.** 0 failed, 0 flaky. retries=0, single headed pass.

## E. Reproduce

```bash
pnpm db:seed                                          # restore deterministic fixtures (self-restoring)
pnpm test                                             # unit (38)
pnpm exec playwright test --headed --reporter=list    # e2e (27), visible Chromium
# full gate (headless): pnpm test:all
```

> **Phase-1 testing status:** effectively closed — 65 automated tests green across the lifecycle/permission/auth/admin surface. Only **F3-B2** (event-timeline assertion) waits for a UI surface in Phase 2; all other open items are 🔜 Phase-3 driver flows or 📋 schema/unit-guaranteed.
