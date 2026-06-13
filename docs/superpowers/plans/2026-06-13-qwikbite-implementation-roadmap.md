# QwikBite — Phase-Wise Implementation Plan (4 modules, full functionality)

> **Build branch:** `Abhi/qwikbite` (created from `main`, 2026-06-13).
> **Reviewed against the actual code on this branch (2026-06-13).** Files read directly: `prisma/schema.prisma`, `lib/orders/state.ts` + `state.test.ts`, `app/(restaurant)/restaurant/orders/[id]/actions.ts`, `app/(restaurant)/_lib/{queue,format}.ts`, `app/(restaurant)/_components/{order-actions,status-badge}.tsx`, `app/(auth)/actions.ts`, `auth.config.ts`, `app/(admin)/_components/badge.tsx`, `app/(admin)/admin/orders/page.tsx`, `prisma/seed.ts`, `e2e/restaurant.spec.ts`. The foundation is the work already integrated from the earlier slice — reuse it, do not rebuild it. Every Phase 1 "what breaks" claim was verified accurate; review changed **no phase scope** but corrected **one Phase 1 detail**: the seed must include a PAID `PLACED` order (so the rewritten restaurant E2E has something to advance), not only a PAID `READY` order.

## Context

QwikBite is a four-sided, web-only food-delivery marketplace (Customer / Restaurant / Driver / Admin) built as **one Next.js 16 app with four role-scoped route groups**, one Postgres DB (Prisma), one Auth.js config. It orbits a single order state machine; delivery is **lightweight self-claim** (no GPS/dispatch/surge). Source of truth: `docs/food-delivery/PRD.md` (v2, 4 roles) and the hi-fi mockups in `docs/food-delivery/design/*.html` (35 screens across 4 roles). `docs/food-delivery/WIREFRAMES.md` is **stale** (3-role, no driver, no `READY`) — do not plan from it.

**Why this plan exists:** the repo is ~30% built (foundation, auth, restaurant supply side, admin governance, and the order state machine *minus* `READY` and the driver leg are done and tested). The remaining work — customer demand side, payments, the entire driver module, the `READY`+driver delivery leg, customer tracking, admin driver-approval/overrides — has never been sequenced into an accurate, dependency-ordered roadmap that accounts for *what breaks in existing code*. This document is that roadmap. It does **not** decompose phases into tasks — run the writing-plans skill per phase when ready to build.

**Strategy (chosen): hybrid walking-skeleton, stub-pay seam.** Phases 1–3 build a deliberately thin end-to-end loop across all four roles using a **stubbed payment** (a dev action flips `Payment→PAID`), so the full *discover → order → cook → claim → deliver → earn* loop is exercisable before any Stripe wiring. Phases 4–6 deepen: real Stripe, admin overrides + design extras, then hardening/deploy. The key seam: the restaurant queue is **already** payment-gated (`payment.status==='PAID'`), so swapping stub→Stripe later changes only *what flips the payment*, never order creation.

## Current baseline (Phase 0 — already done, do not rebuild)

| Done | Where |
|---|---|
| Next.js 16 + React 19 + Tailwind v4 + TS scaffold; shadcn/ui | repo root, `components/ui/` |
| Auth.js credentials (email/password, bcrypt), JWT role sessions, sign in/up | `lib/auth.ts`, `auth.config.ts`, `app/(auth)/` |
| Route guard by role (Next.js 16) | `proxy.ts` (NOT middleware.ts) |
| Prisma 7 (pg adapter) singleton; client generated to `lib/generated/prisma` | `lib/db.ts` |
| Schema: User/Restaurant/MenuCategory/MenuItem/Address/Order/OrderItem/Payment/OrderStatusEvent + init migration | `prisma/schema.prisma`, `prisma/migrations/20260612071222_init` |
| Restaurant supply side: onboarding/profile, menu CRUD + availability, order queue (SWR poll, PAID-gated), order detail + transitions | `app/(restaurant)/**` |
| Admin governance: overview KPIs, restaurants approve/suspend, orders list, users list | `app/(admin)/**` |
| Order state machine + unit tests | `lib/orders/state.ts`, `lib/orders/state.test.ts` |
| Stripe client singleton (factory only — no checkout/webhook) | `lib/stripe.ts` |
| Seed: admin, restaurant owner + APPROVED restaurant + menu, customer | `prisma/seed.ts` |
| E2E: auth, admin approve/suspend | `e2e/auth.spec.ts`, `e2e/admin.spec.ts` |

**Not built:** `(driver)` route group (entire module), customer discovery/detail/cart/checkout/tracking/history, Stripe webhook + checkout, `READY` state + driver delivery leg, actor-aware authz in the state machine, admin driver approval, admin order overrides.

**Schema gaps to close:** no `DRIVER` role, no `Driver` model, no `Order.driverId`, no `READY` in `OrderStatus`, no `DriverStatus` enum.

### Integrated models & state — reuse, do NOT recreate (verified in code 2026-06-13)

The earlier slice already integrated these. Build phases extend them; they are never rebuilt.

- **9 Prisma models** (`prisma/schema.prisma`): `User`, `Restaurant`, `MenuCategory`, `MenuItem`, `Address`, `Order`, `OrderItem`, `Payment`, `OrderStatusEvent`. Most relations are `onDelete: Cascade`; `Order→Restaurant` / `Order→customer` are non-cascading.
- **Enums present:** `Role{CUSTOMER,RESTAURANT,ADMIN}` · `RestaurantStatus{PENDING,APPROVED,SUSPENDED}` · `OrderStatus{PLACED,ACCEPTED,PREPARING,OUT_FOR_DELIVERY,DELIVERED,REJECTED,CANCELLED}` · `PaymentStatus{PENDING,PAID,FAILED}`.
- **Money fields already exist on `Order`:** `subtotalCents`, `deliveryFeeCents @default(0)`, `totalCents`, `addressLine` (snapshot). The customer/checkout phase **populates** these — it does not add them. `OrderItem` already snapshots `name`+`priceCents`.
- **State machine already exists** (`lib/orders/state.ts`), exporting `nextStatuses`, `canTransition`, `isTerminal`, `assertTransition(from,to)`, `IllegalTransitionError`. Verified current transition table: `PLACED→[ACCEPTED,REJECTED,CANCELLED]`, `ACCEPTED→[PREPARING]`, `PREPARING→[OUT_FOR_DELIVERY]`, `OUT_FOR_DELIVERY→[DELIVERED]`; terminal `DELIVERED/REJECTED/CANCELLED`. **`assertTransition` has no actor parameter yet** — Phase 1 adds `READY`, the `PREPARING→READY→OUT_FOR_DELIVERY` path, and the actor model.
- **Reusable building blocks** (mirror their patterns, don't re-author): ownership helper `app/(restaurant)/_lib/restaurant.ts#requireOwnedRestaurant`; SWR polling `app/(restaurant)/_components/queue-board.tsx`; JSON envelope route `app/(restaurant)/restaurant/orders/queue/route.ts`; `formatCents` in `app/(restaurant)/_lib/format.ts` + `app/(admin)/_components/money.ts`; Prisma singleton `@/lib/db`; types from `@/lib/generated/prisma/*`.

> **Net effect on the plan:** because the schema's money fields and the state machine already exist, Phase 1's schema work is purely *additive* (`DRIVER`, `Driver`, `driverId`, `READY`, `DriverStatus`) and Phase 2's checkout *fills* existing columns rather than migrating new ones — exactly as the phases below assume.

## Decisions (confirmed with user)

1. **Tests: test-as-you-go** ✓ confirmed. Each phase exits only when its core logic has Vitest unit tests + a Playwright happy-path E2E (matches your global rules and the repo's existing pattern).
2. **All four design extras are in scope** ✓ confirmed, built in Phase 5 and tagged `[design-extra]`: multi-address book, restaurant open/closed toggle, per-order prep-time selector, driver online/offline toggle.
3. **Admin overrides: reassign + force-cancel** ✓ confirmed (design A5), built in Phase 5 (adds admin-only state-machine edges).
4. **Visual polish: style as we go + retrofit** ✓ confirmed. The foundation was built functional-first (plain shadcn/Tailwind defaults). To meet the PRD "production-grade UI" goal: establish a shared design system that matches the hi-fi mockups (`docs/food-delivery/design/*.html`), **retrofit the existing auth/restaurant/admin screens** (Phase 1.5), and build every later phase's screens **to match the mockups from the start**. No dedicated "restyle everything at the end" — polish is continuous.
5. Assumed (not in question scope): single currency/region; admin seeded; driver self-signup allowed (design D1); demo data volumes small.

---

## Phase 1 — Lifecycle & schema groundwork (READY + driver model + actor authz)

**Goal / milestone:** Make the existing codebase 4-role-aware. Schema gains the driver model + `READY`; the state machine encodes *who* may fire each transition; existing restaurant/admin code is updated to the new lifecycle without regressions. Nothing user-facing yet — this unblocks everything else.

**Why first:** every map keyed by `Record<OrderStatus,…>`/`Record<Role,…>` (queue grouping, status badges, action labels, `ROLE_HOME`) won't compile until the generated enums change, and `state.test.ts` asserts the *old* transition table. This must land before customer/driver work.

- **Depends on:** Phase 0. **Size:** M.
- **In scope (PRD FR-12/13/14, 5.4, 5.5; CLAUDE.md lifecycle):**
  - Schema + migration (additive, safe): `Role += DRIVER`; `OrderStatus += READY`; new `DriverStatus{PENDING,APPROVED,SUSPENDED}`; new `Driver` model (`userId` unique, name, phone?, status, `orders[]`); `Order.driverId` nullable + relation (`onDelete: SetNull`); index `@@index([status, driverId])` for the pool query. Regenerate client. *(If Postgres rejects `ALTER TYPE … ADD VALUE` in-txn, split into two migrations — enum values first, table/FK second.)*
  - State machine (`lib/orders/state.ts`): graph `PREPARING→READY`, `READY→OUT_FOR_DELIVERY`; add `Actor` union + `TRANSITION_ACTORS` map + `canActorTransition()`; extend `assertTransition(from,to,actor?)` (optional actor = backward-compatible); add `UnauthorizedActorError`. Actor table: PLACED→ACCEPTED/REJECTED (RESTAURANT,ADMIN), PLACED→CANCELLED (CUSTOMER,ADMIN), ACCEPTED→PREPARING & PREPARING→READY (RESTAURANT,ADMIN), READY→OUT_FOR_DELIVERY & OUT_FOR_DELIVERY→DELIVERED (DRIVER,ADMIN).
  - Restaurant code: in `app/(restaurant)/restaurant/orders/[id]/actions.ts` **remove** `outForDelivery`/`markDelivered`, **add** `markReady`, pass `"RESTAURANT"` actor to `assertTransition`. Update `_lib/queue.ts` (add a `ready` bucket "Ready · awaiting driver"), `_components/order-actions.tsx`, `_lib/format.ts` (labels), `_components/status-badge.tsx` (READY color), `_components/queue-board.tsx`.
  - Admin: `app/(admin)/_components/badge.tsx` (+READY, +DRIVER tones), `app/(admin)/admin/orders/page.tsx` filter (+Ready).
  - Auth: `app/(auth)/actions.ts` `ROLE_HOME += DRIVER:'/driver'`, signup role enum `+DRIVER` and **create the `Driver` row (PENDING) on driver signup**; `auth.config.ts` add `/driver → role==='DRIVER'`; `signup-form.tsx` add Driver option.
  - Seed: APPROVED driver (`driver@demo.test`) + **two seeded paid orders**: one **PAID `PLACED`** order (so the rewritten restaurant E2E has something to advance accept→prepare→markReady) and one **PAID `READY`, `driverId:null`** order with its event trail (so the driver pickup pool is non-empty for Phase 3). *Code-review note: the current seed creates NO orders, and `e2e/restaurant.spec.ts` itself documents that it cannot pass without a paid order — so Phase 1 must seed the PLACED order, not rely on checkout (Phase 2).*
- **Out of scope now:** any driver UI, customer UI, Stripe.
- **Key files:** `prisma/schema.prisma`, `prisma/migrations/*`, `lib/orders/state.ts` + `state.test.ts`, `app/(restaurant)/restaurant/orders/[id]/actions.ts`, `app/(restaurant)/_lib/queue.ts`, `app/(auth)/actions.ts`, `auth.config.ts`, `prisma/seed.ts`, `e2e/restaurant.spec.ts`.
- **Entry criteria:** Phase 0 baseline green (`pnpm test`, `pnpm lint`, `pnpm build`).
- **Exit / acceptance:** migration applies + client regenerates; `state.test.ts` updated (legal `PREPARING→READY`, `READY→OUT_FOR_DELIVERY`; `PREPARING→OUT_FOR_DELIVERY` now illegal) **plus new actor-rejection tests** (restaurant blocked from delivery leg; driver blocked from kitchen leg; admin allowed on all legal edges); `e2e/restaurant.spec.ts` rewritten to stop at READY ("no further actions") and passes **against the seeded PAID PLACED order**; `pnpm build`/`pnpm lint` clean; seed produces both a PAID PLACED order (for the restaurant E2E) and a claimable PAID READY order (for the driver pool).
- **Risks:** Postgres enum-in-transaction caveat (mitigation: split migration); forgetting an exhaustive `Record<enum>` map (TS will flag); driver signup must create the `Driver` row (coupled change).

---

## Phase 1.5 — Design system foundation + visual retrofit

**Goal / milestone:** A shared visual design system matching the hi-fi mockups, applied to the existing screens — so the app *looks* production-grade and every later phase inherits the look instead of bolting it on. (Per Decision #4 — "style as we go + retrofit.")

- **Depends on:** Phase 1. **Size:** M.
- **In scope:**
  - **Design tokens + theme** in `app/globals.css` (Tailwind v4 `@theme`): brand color (coral `#FF3B5C` per the mockups), ink/muted text, surface/line colors, radius, shadow, font — derived from `docs/food-delivery/design/index.html`'s palette. One source of truth for color/spacing.
  - **Shared shells** styled to the mockups: dashboard shell (sidebar + topbar) used by admin/restaurant; the admin console's denser, polished look (KPI cards with trend, refined tables) per `admin-design.html`; the customer top-nav shell per `customer-design.html`.
  - **Polish shared primitives**: `components/ui/*` (button, card, table, badge), `_components/{stat-card,status-badge,badge,table}` — spacing, weight, color, hover states to match mockups.
  - **Retrofit existing screens** to the system: auth (signin/signup), restaurant (queue/menu/order detail/profile), admin (overview/restaurants/users/orders). No behavior change — visual only.
- **Out of scope now:** new features (those are Phases 2–5); pixel-perfect parity (aim for "clearly the same design language," not 1:1).
- **Key files:** `app/globals.css`, `components/ui/*`, `app/(restaurant)/_components/dashboard-shell.tsx`, `app/(admin)/_components/*`, the existing role pages (visual props/classes only).
- **Entry criteria:** Phase 1 complete.
- **Exit / acceptance:** existing screens visibly match the mockups' design language (color, sidebar, cards, tables); `pnpm build`/`lint` clean; no E2E/unit regressions (selectors that tests rely on — e.g. status label text, button names — are preserved). A quick browser pass on each retrofitted screen.
- **Risks:** changing markup can break Playwright selectors (mitigation: keep accessible names/text the tests query — "Accept", "Mark ready", status labels, "Open"); scope creep into feature work (hold the line — visual only).
- **Tests:** re-run full gate (`pnpm test && pnpm build && pnpm test:e2e`) to confirm the retrofit didn't regress behavior; visual check in the browser.

> From here on, **every phase's new screens are built styled-to-mockup** using this system — there is no separate "polish later" step.

---

## Phase 2 — Customer demand side + stub-pay to the restaurant queue

**Goal / milestone:** A customer can discover an APPROVED restaurant, build a single-restaurant cart, check out, "pay" (stub), and watch the order appear in the restaurant queue and advance to `READY` with a live tracking timeline. Half the walking skeleton.

- **Depends on:** Phase 1. **Size:** L.
- **In scope (PRD FR-6/7/8/9/11/15/16; design C4–C12):**
  - Discovery `app/(customer)/browse/page.tsx` (replace placeholder): APPROVED grid, name search + cuisine filter via GET form/links (Server Component). Detail `app/(customer)/restaurants/[id]/page.tsx`: APPROVED-gated `findFirst` (404 otherwise — no info leak), menu by category, available items only.
  - Cart: pure immutable core `app/(customer)/_lib/cart.ts` (+`cart.test.ts`); `_lib/cart-context.tsx` (client, localStorage `fd_cart_v1`, single-restaurant rule); `_components/add-to-cart-button.tsx` (cart-conflict confirm), `cart-button.tsx`; `app/(customer)/cart/page.tsx`. Customer scaffolding: `app/(customer)/layout.tsx` (wraps `CartProvider`), `_lib/customer.ts` (`requireCustomer()` ownership helper).
  - Checkout `app/(customer)/checkout/page.tsx` + `checkout/actions.ts#placeOrder`: **server re-validates** cart (live `isAvailable`+`priceCents`, reject foreign/cross-restaurant items), snapshots prices, `deliveryFeeCents` from new `lib/orders/fees.ts#FLAT_DELIVERY_FEE_CENTS`, `totalCents=subtotal+fee`, creates `Order(PLACED)+OrderItems+Payment(PENDING)` in one transaction. Single address entered at checkout (multi-address deferred to Phase 5).
  - **Stub payment seam:** new `lib/orders/payment.ts#markOrderPaid(orderId)` = idempotent `payment.updateMany(where status PENDING → PAID)`. Confirmation/tracking page `app/(customer)/orders/[id]/page.tsx` renders a **dev-only** `<MarkPaidButton>` (`NODE_ENV!=='production'` + ownership) calling `orders/[id]/actions.ts#devMarkPaid` → `markOrderPaid` → revalidate `/restaurant`.
  - Tracking + history: `orders/[id]/status/route.ts` (polled JSON `{ok,data,error}`, reuse queue-board fetcher pattern, stop at `isTerminal`); `orders/page.tsx` history scoped to `userId`; `cancelOrder` action (only `PLACED`, enforced via `assertTransition(...,'CUSTOMER')`).
- **Out of scope now:** real Stripe (Phase 4), driver claim (Phase 3), saved-address book (Phase 5).
- **Key files:** `app/(customer)/**`, `lib/orders/fees.ts` (new), `lib/orders/payment.ts` (new).
- **Entry criteria:** Phase 1 exit met.
- **Exit / acceptance:** customer can place a paid (stubbed) order that appears in the restaurant queue; restaurant advances it to `READY`; customer tracking timeline updates by polling; a customer cannot open another customer's order (ownership 404); cancel works only before ACCEPTED. AC-6 (paid-only reaches queue) holds with stub pay.
- **Risks:** localStorage price drift (mitigated: server recompute); partial order on unavailable item (reject, don't create); double-submit (disable button + idempotent flip).
- **Tests:** `cart.test.ts` (cents totals, qty-0 removal, single-restaurant flag, immutability); checkout money math (subtotal+fee=total, snapshot); `markOrderPaid` idempotency; `e2e/customer.spec.ts` happy path with dev mark-paid + ownership/cancel negatives.

---

## Phase 3 — Driver module + admin driver approval (closes the loop)

**Goal / milestone:** The delivery leg works end-to-end. An admin approves a driver; the approved driver sees the pickup pool, atomically claims a `READY` order (→ OUT_FOR_DELIVERY), delivers it (→ DELIVERED), and sees an earnings tally. After this phase the **entire four-sided loop closes** on stub payment.

- **Depends on:** Phases 1 & 2. **Size:** L.
- **In scope (PRD FR-D1..D6, FR-17; design D1–D8, A4):**
  - Driver authz: `app/(driver)/_lib/driver.ts` — `getDriver()` (for onboarding/PENDING screen) and `requireApprovedDriver()` (mirrors `requireOwnedRestaurant`; throws unless `status==='APPROVED'`).
  - Driver screens: onboarding/verification (D2, PENDING), pickup pool (D3) `app/(driver)/driver/pool/page.tsx` + polled `pool/route.ts` (query `status:READY, driverId:null, payment PAID`), order detail/claim (D4), active delivery (D5), earnings (D6), history (D7), profile (D8). Reuse `AppHeader`; mobile-web layout.
  - Claim/deliver actions `app/(driver)/driver/order/[id]/actions.ts`: `claimOrder` = **atomic** `order.updateMany(where id+status:READY+driverId:null → OUT_FOR_DELIVERY + driverId)`; `count===0` ⇒ typed "already claimed" error, **no event written**; on success append `OrderStatusEvent` (interactive `$transaction`); defensively `assertTransition('READY','OUT_FOR_DELIVERY','DRIVER')`. `markDelivered` = re-check `order.driverId===driver.id` + status OUT_FOR_DELIVERY, `assertTransition(...,'DRIVER')`, transaction update+event.
  - Driver-scoped queries `_lib/deliveries.ts`: `getMyDeliveries(driverId)` (active/history), `getEarnings(driverId)` = `aggregate _sum deliveryFeeCents where status:DELIVERED` (integer cents, display only).
  - Admin driver management `app/(admin)/admin/drivers/page.tsx` + `actions.ts` (approve/suspend, mirrors restaurants); add driver KPIs to admin overview (A2). proxy/auth already allow `/driver` from Phase 1.
- **Out of scope now:** driver online/offline toggle (Phase 5 extra), admin reassign/cancel (Phase 5).
- **Key files:** `app/(driver)/**` (new), `app/(admin)/admin/drivers/**` (new), `app/(admin)/admin/page.tsx` (KPIs).
- **Entry criteria:** Phases 1–2 exit met; seed has an APPROVED driver + a READY paid order.
- **Exit / acceptance (AC-3, AC-7, AC-8):** admin approves a PENDING driver → driver can claim; approved driver claims a READY order and marks delivered; earnings tally reflects summed `deliveryFeeCents`; a **second** driver claiming the same order gets "already claimed"; a PENDING/SUSPENDED driver cannot claim; a driver sees/acts only on orders they claimed. Full loop discover→pay(stub)→READY→claim→DELIVERED works with no manual DB edits.
- **Risks:** TOCTOU race (mitigation: conditional `updateMany`, never read-then-write); status-flip without audit row (mitigation: interactive transaction); approved-only gate in action layer not just UI.
- **Tests:** atomic-claim unit (0-rows path; claim of non-READY/already-claimed writes no event); earnings money-math unit (DELIVERED-only, empty→0); `e2e/driver.spec.ts` claim→deliver + second-driver "already claimed" negative + PENDING-driver-cannot-claim negative.

---

## Phase 4 — Real Stripe (deepen money)

**Goal / milestone:** Replace the stub payment trigger with Stripe test-mode Checkout + webhook. Order creation is untouched; only *what flips PAID* changes.

- **Depends on:** Phase 2 (seam). **Size:** M.
- **In scope (PRD FR-10, AC-6, §7.13):**
  - `createCheckoutSession(orderId)` action: build Stripe Checkout from snapshotted `OrderItem`s + delivery-fee line, `metadata:{orderId}`, store `stripeSessionId`, redirect to Stripe; success/cancel → `/orders/[id]`.
  - `app/api/stripe/webhook/route.ts` (Route Handler): verify signature (`STRIPE_WEBHOOK_SECRET`), on `checkout.session.completed` call the **same** `markOrderPaid(orderId)` (idempotent), revalidate queue + order pages; bad signature → 400.
  - **Seam swap:** delete `devMarkPaid` action + `<MarkPaidButton>` (keep `markOrderPaid`). Add a **permanent** admin "mark paid" fallback (`app/(admin)/admin/orders/...` → `markOrderPaid`) per PRD §7.13.
  - Env: enable `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`; local `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
- **Out of scope now:** payouts/Stripe Connect (Future Scope, never in this build).
- **Key files:** `app/(customer)/checkout/actions.ts`, `app/api/stripe/webhook/route.ts` (new), `lib/stripe.ts`, `app/(admin)/admin/orders/**`.
- **Entry criteria:** Phase 2 loop green on stub pay.
- **Exit / acceptance:** an order reaches the restaurant queue **only after** the webhook flips PAID (AC-6 with real Stripe); webhook is idempotent (replay → single PAID); bad signature rejected; admin fallback flips a stuck order.
- **Risks:** webhook signature/secret misconfig (admin fallback mitigates); idempotency (predicate matches only `status:PENDING`).
- **Tests:** webhook idempotency + bad-signature (integration/unit); customer E2E paying with Stripe test card `4242…` **or** a simulated signed webhook POST asserting queue visibility flips only after PAID.

---

## Phase 5 — Admin overrides + design extras (deepen governance & polish)

**Goal / milestone:** Complete the admin operations console and the design-spec features beyond core MVP, so the build matches the hi-fi mockups.

- **Depends on:** Phases 3 & 4. **Size:** M.
- **In scope:**
  - **Admin live order monitor (design A5):** reassign-driver (change `driverId` on a claimed order, admin-only) + force-cancel (admin-only `*→CANCELLED` edge from any non-terminal state, with driver-orphan handling + cancellation note). Adds admin-only edges/actors to `lib/orders/state.ts` + tests; driver-picker UI. `[design A5]`
  - `[design-extra]` Multi-address book (C15): `app/(customer)/account/addresses` CRUD over the existing `Address` model; checkout selects a saved address.
  - `[design-extra]` Restaurant open/closed toggle (R3/R13): `Restaurant.isAcceptingOrders` boolean; gates ordering + shows "Closed".
  - `[design-extra]` Per-order prep-time selector (R5): optional `prepMinutes` on accept; display on detail/tracking.
  - `[design-extra]` Driver online/offline toggle (D3): `Driver.isOnline`; pool/claim respect it.
  - Empty/error states across all roles; marketing landing (S1) polish; account/settings screens (C14).
- **Out of scope now:** ratings/reviews, promo codes, favorites, analytics, heavy logistics, push (all Future Scope per PRD §7.12).
- **Key files:** `app/(admin)/admin/orders/**`, `lib/orders/state.ts` (+admin edges), `app/(customer)/account/**`, `prisma/schema.prisma` (+`isAcceptingOrders`, `prepMinutes?`, `Driver.isOnline` — one additive migration), restaurant/driver settings pages.
- **Entry criteria:** Phases 3–4 exit met (full loop on real Stripe).
- **Exit / acceptance:** admin can force-cancel any in-flight order and reassign a claimed order to another approved driver; each design-extra works per its mockup; no screen lacks an empty/error state.
- **Risks:** new state edges must keep `IllegalTransitionError` for graph violations even for admin (graph check before actor check); driver-orphan on cancel/reassign (decide: keep `driverId` for audit vs null it).
- **Tests:** admin edge units (force-cancel from each non-terminal state; reassign keeps audit); E2E admin reassign + cancel; per-extra E2E (closed restaurant blocks ordering; address selection at checkout).

---

## Phase 6 — Hardening, full E2E suite, deploy

**Goal / milestone:** Production-grade pass and live deploy. Final acceptance sweep AC-1…AC-8.

- **Depends on:** Phases 1–5. **Size:** M.
- **In scope:** complete role-isolation negative suite (every cross-role/cross-tenant attempt blocked — AC-4); money-math edge tests; seed completeness (all four roles + sample orders across states); accessibility/responsive sweep per design; deploy to Vercel + Postgres (Neon/Vercel Postgres), Prisma migrate in deploy, Stripe webhook pointed at prod URL; README/runbook; `.env` documentation.
- **Out of scope now:** load testing (JMeter) unless requested; multi-region.
- **Key files:** `e2e/**`, `prisma/seed.ts`, deploy config, `README.md`.
- **Entry criteria:** Phases 1–5 green locally.
- **Exit / acceptance (MVP "done", PRD §7.16):** AC-1 (discover→Stripe pay→track→DELIVERED, no manual DB edits), AC-2 (restaurant onboard→approve→menu→READY), AC-3 (admin approves restaurant + driver), AC-4 (no cross-role/tenant access), AC-5 (illegal transitions blocked incl. restaurant attempting DELIVERED), AC-6 (only paid orders in queue), AC-7 + AC-8 (driver claim/deliver/earnings + isolation + atomic claim) all pass against the deployed app.
- **Risks:** prod webhook misconfig (admin fallback); migration drift between local and prod (run migrate in CI/deploy).
- **Tests:** full Playwright suite green in CI/headless; all Vitest units green; coverage ≥80% on `lib/orders/*`, cart, money.

---

## Cross-cutting conventions (reuse — do not reinvent)

- **Two-layer authz** everywhere: `proxy.ts` by role + per-action ownership re-check. Customer scope = `requireCustomer()`/`session.user.id`; restaurant = `requireOwnedRestaurant()`; driver = `requireApprovedDriver()` (new). Scope writes with `updateMany/deleteMany … where owner` so a foreign id is a 0-row no-op (`.claude/rules/authorization.md`).
- **Prisma** from `@/lib/generated/prisma/*`, singleton `@/lib/db` (`.claude/rules/data-access.md`). Never `@prisma/client`, never `new PrismaClient()`.
- **Mutations = Server Actions** ending in `revalidatePath`; **Route Handlers only** for Stripe webhook + SWR-polled JSON, envelope `{ok,data,error}` (`.claude/rules/nextjs16-conventions.md`).
- **State machine is the single source of truth** — every transition goes through `assertTransition(from,to,actor)` and appends an `OrderStatusEvent`.
- **Money = integer cents** everywhere; never floats. Consolidate the three `formatCents` copies into `lib/money.ts` when the customer area becomes the third consumer.
- **SWR polling** pattern reused from `app/(restaurant)/_components/queue-board.tsx` (fetcher checks `ok`, `fallbackData`, `refreshInterval`, stop at `isTerminal`).
- **Per-area structure:** `app/(role)/_lib/*` + `_components/*` + per-route `actions.ts`, mirroring `(restaurant)`.
- **Build-to-mockup (Decision #4):** all new screens use the Phase 1.5 design system and match `docs/food-delivery/design/*.html` (color, shell, cards, tables) — styling is part of each phase's definition of done, not deferred. Preserve the accessible text/names E2E tests query.

## Testing strategy (per-phase, layered — no big-bang QA at the end)

Goal: every phase is **fully tested before the next begins**, with cross-phase regression caught automatically. Timing differs by test type:

- **Scenarios up front:** each phase's plan includes a **test matrix** — positive, negative, and edge cases tied to that phase's acceptance criteria — written *before* implementation (the "what to verify"), so we build toward known targets.
- **Unit tests test-first (TDD):** pure logic (state machine + actors, money/cart math, atomic claim) — write the failing test, then implement (as in Phase 1 Task 2). Push **exhaustive** positive/negative/edge coverage *here* — it's fast and cheap.
- **Playwright E2E after the phase's UI exists, within the phase:** encode the matrix's **critical journeys + high-value negatives** (role isolation, payment-gates-queue, atomic-claim race). Reserve E2E for journeys, not every permutation (test-pyramid — keeps it fast, non-flaky).
- **Organize E2E by flow, not by phase:** `e2e/{customer-order,restaurant-fulfillment,driver-claim,admin,role-isolation}.spec.ts`. The suite only grows; phases add or update specs.
- **Phase gate = run the FULL accumulated suite:** `pnpm test:all` (unit + build + all E2E). A later-phase change that breaks an earlier flow turns the existing spec **red immediately** — this is the cross-phase regression net. A phase is "done" only when `test:all` is green.
- **Critical-path smoke (from Phase 3 on):** one E2E that walks customer → restaurant → driver → admin end-to-end; re-run every later phase as the fastest breakage canary.
- **Determinism:** seed-based fixtures that self-restore (the Phase 1 seed pattern); no fixed sleeps — wait on text/elements. E2E that mutate state must reseed or provision their own data so the suite stays re-runnable.
- **Coverage:** keep the 80% unit target; E2E covers critical flows + key negatives.

## Verification (how to prove each phase end-to-end)

- **Per phase:** `pnpm lint && pnpm build && pnpm test` (Vitest) green; `pnpm test:e2e` for that phase's spec green; `pnpm prisma migrate dev` applies cleanly; `pnpm db:seed` idempotent.
- **Walking skeleton (after Phase 3), browser, stub pay:** sign in as `customer@demo.test` → browse → add items → checkout → dev "mark paid" → sign in as `owner@demo.test`, see the order, advance to READY → sign in as `driver@demo.test`, claim from pool, mark delivered → confirm earnings tally → sign in as `admin@demo.test`, approve a PENDING driver and watch it gain claim ability. Confirm customer tracking timeline advanced through every step.
- **After Phase 4:** repeat using a real Stripe test card (`4242 4242 4242 4242`); confirm the order is invisible to the restaurant until the webhook fires; replay the webhook and confirm a single PAID.
- **Final (Phase 6):** run the full AC-1…AC-8 sweep against the Vercel deployment with the prod Stripe webhook; run the role-isolation negative suite (driver can't touch a foreign/unclaimed order; second driver can't claim a taken one; customer can't open another's order; wrong-role route access redirects).
