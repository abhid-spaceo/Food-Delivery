@AGENTS.md

@.claude/rules/authorization.md
@.claude/rules/data-access.md
@.claude/rules/nextjs16-conventions.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A solo-buildable, four-sided **food-delivery marketplace** (Customer / Restaurant / Driver / Admin). Delivery is **lightweight in-house**: the restaurant takes an order to `READY`, then an admin-approved driver self-claims it from a shared pool and delivers it. Still no GPS, no auto-dispatch, no surge, no serviceability zones.

## Current state: implementation in progress (Slice 1 — Foundation)

- Scaffolded with Next.js 16 (App Router) + React 19 + Tailwind v4, TypeScript, ESLint. No `src/` dir.
- The discovery → PRD → implementation plan lives in `docs/food-delivery/PRD.md`; wireframes/UX in `docs/food-delivery/WIREFRAMES.md`; clickable hi-fi design mockups (4 roles) in `docs/food-delivery/design/index.html`. **Read the PRD before building.**
- **Stack note:** this is Next.js 16 / React 19 / Tailwind v4 — newer than typical training. Heed `AGENTS.md` and consult bundled docs before assuming older patterns.

## Tech stack (fixed — do not substitute)

- **Language:** TypeScript
- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL via Prisma
- **UI:** Tailwind v4 + shadcn/ui
- **Auth:** Auth.js (NextAuth), role-bearing sessions
- **Payments:** Stripe (test mode only)
- **Deploy:** Vercel (+ Vercel Postgres / Neon)

## Project structure (planned — see PRD Phase 6)

- `app/(customer|restaurant|driver|admin|marketing)/` — one app, role-scoped route groups (not four apps).
- `app/api/stripe/webhook/route.ts` — the Stripe webhook (a Route Handler).
- `lib/orders/state.ts` — the order state machine (single source of truth for transitions).
- `lib/auth.ts`, `lib/db.ts` (Prisma singleton), `lib/stripe.ts`.
- `prisma/schema.prisma` — schema sketch lives in PRD Phase 5.
- `proxy.ts` — role-based route protection (Next.js 16; replaces `middleware.ts`).

## Architecture (the big picture)

- **One Next.js app, four role-scoped route groups.** One deploy, one DB, one auth config; hard role boundaries enforced in `proxy.ts`.
- **Mutations = Server Actions. Route Handlers are the exception** — use them only for the Stripe webhook and any JSON the SWR polling hooks consume.
- **The order state machine lives in `lib/orders/state.ts`.** All transitions validate there so illegal jumps (e.g. `PLACED → DELIVERED`) are impossible. States: `PLACED → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED`; branches `REJECTED` (restaurant) and `CANCELLED` (customer/admin, only before `ACCEPTED`). The state machine also encodes **who** may fire each transition: the restaurant drives through `READY`; the claiming **driver** owns `READY → OUT_FOR_DELIVERY` (on claim) and `OUT_FOR_DELIVERY → DELIVERED`. A restaurant may not mark delivered.
- **Every transition appends an `OrderStatusEvent` row** — this is the audit trail and the customer's tracking timeline.
- **Two-layer authorization.** `proxy.ts` gates route groups by role; **every Server Action independently re-verifies ownership** (a restaurant mutates only its own data; a customer reads/cancels only their own orders; a driver acts only on orders **they claimed**, and may claim only an unclaimed `READY` order while `APPROVED`). Never trust the route guard alone — this is the #1 risk in the PRD.

## Business rules the code must enforce

- **Single-restaurant cart** — one order = one restaurant; adding from another restaurant warns/clears the cart.
- **Price snapshotting** — `OrderItem` copies `name` + `priceCents` at purchase time; the `Order` also snapshots `deliveryFeeCents`. Later menu/fee edits must never change past orders.
- **Money is integer cents everywhere** (`priceCents`, `deliveryFeeCents`, `subtotalCents`, `totalCents`) — no floats for money. `totalCents = subtotalCents + deliveryFeeCents`.
- **Payment gates the queue** — an order is created at `PLACED` but only appears in the restaurant's queue once the Stripe webhook flips `Payment` to `PAID`. Payment state is separate from order state.
- **Driver claim is first-come and atomic** — a `READY` order enters a shared pool; claim with a conditional update (`updateMany where status=READY AND driverId=null`). If it changes 0 rows, the order was already taken. Driver earnings = sum of `deliveryFeeCents` over that driver's `DELIVERED` orders (display only — no payouts).
- **Visibility** — customers see only `APPROVED` restaurants; new restaurants are `PENDING` until an admin approves them. Drivers onboard the same way (`PENDING → APPROVED`); only `APPROVED` drivers may claim orders.

## Data model

Entities, relationships, lifecycle states, and the Prisma schema sketch are in `docs/food-delivery/PRD.md` Phase 5. Core entities: `User`, `Restaurant`, `Driver`, `MenuCategory`, `MenuItem`, `Address`, `Order` (gains nullable `driverId` + `deliveryFeeCents`), `OrderItem`, `Payment`, `OrderStatusEvent`.

## Code style / conventions (from the PRD)

- **Server Components by default** for data reads; client components only where needed.
- **JSON endpoints use the envelope `{ ok, data, error }`.**
- **Cart state** = React context + `localStorage`, reconciled at checkout — no global state library.
- **SWR polling** only where status changes (order tracking, restaurant order queue) — never websockets/SSE.

## Workflows & conventions

- **Build order** (dependency-ordered, PRD Phase 8): auth/roles → DB schema → restaurant profile + admin approval → driver profile + admin approval → menu CRUD → discovery + cart → checkout (+ delivery fee) + Stripe webhook → order state machine (incl. `READY`) → restaurant queue → driver pickup pool + claim/deliver + earnings → customer tracking/history → admin dashboard.
- **Testing intent:** Playwright E2E for the happy paths (customer order, restaurant fulfillment to `READY`, driver claim→deliver, admin approval of restaurant + driver) + role-isolation negative tests (driver can't touch an unclaimed/foreign order; second driver can't claim a taken order); unit tests for the order state machine (incl. driver-only delivery leg), the atomic claim, and money math. Deterministic seed data; no fixed sleeps — wait on status text/elements.
- **MVP "done":** customer goes discover → pay (Stripe test) → track → `DELIVERED` with no manual DB edits; no role can reach another's data; illegal transitions blocked; unpaid orders never reach the restaurant queue. Full criteria: PRD §7.16.

## Commands

- `pnpm dev` — start the dev server (Turbopack).
- `pnpm build` — production build.
- `pnpm start` — run the production build.
- `pnpm lint` — ESLint.
- `pnpm test` — Vitest unit tests (state machine, money math).
- `pnpm prisma migrate dev` — apply schema migrations locally.
- `pnpm prisma db seed` — load deterministic seed data (admin + sample restaurant + approved driver).

## Things to avoid

- **Do not introduce** microservices, Kafka, Redis, event buses, Kubernetes, or websockets/SSE — explicit PRD complexity guardrails. Flag the user if a task seems to need one.
- **Do not relitigate the locked decisions** (lightweight self-claim delivery — **no GPS/auto-dispatch/surge/zones**, Stripe test-mode, polling-not-push, four roles) without asking the user.
- **Do not enforce authorization in the route guard (`proxy.ts`) alone** — always re-check ownership in the Server Action.
- **Do not store money as floats.**
