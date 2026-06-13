@AGENTS.md

@.claude/rules/authorization.md
@.claude/rules/data-access.md
@.claude/rules/nextjs16-conventions.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A solo-buildable, three-sided **food-delivery marketplace** (Customer / Restaurant / Admin). Delivery is restaurant-fulfilled — no courier app, no GPS, no dispatch engine.

## Current state: implementation in progress (Slice 1 — Foundation)

- Scaffolded with Next.js 16 (App Router) + React 19 + Tailwind v4, TypeScript, ESLint. No `src/` dir.
- The discovery → PRD → implementation plan lives in `docs/food-delivery/PRD.md`; wireframes/UX in `docs/food-delivery/WIREFRAMES.md`. **Read the PRD before building.**
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

- `app/(customer|restaurant|admin|marketing)/` — one app, role-scoped route groups (not three apps).
- `app/api/stripe/webhook/route.ts` — the Stripe webhook (a Route Handler).
- `lib/orders/state.ts` — the order state machine (single source of truth for transitions).
- `lib/auth.ts`, `lib/db.ts` (Prisma singleton), `lib/stripe.ts`.
- `prisma/schema.prisma` — schema sketch lives in PRD Phase 5.
- `proxy.ts` — role-based route protection (Next.js 16; replaces `middleware.ts`).

## Architecture (the big picture)

- **One Next.js app, three role-scoped route groups.** One deploy, one DB, one auth config; hard role boundaries enforced in `proxy.ts`.
- **Mutations = Server Actions. Route Handlers are the exception** — use them only for the Stripe webhook and any JSON the SWR polling hooks consume.
- **The order state machine lives in `lib/orders/state.ts`.** All transitions validate there so illegal jumps (e.g. `PLACED → DELIVERED`) are impossible. States: `PLACED → ACCEPTED → PREPARING → OUT_FOR_DELIVERY → DELIVERED`; branches `REJECTED` (restaurant) and `CANCELLED` (customer/admin, only before `ACCEPTED`).
- **Every transition appends an `OrderStatusEvent` row** — this is the audit trail and the customer's tracking timeline.
- **Two-layer authorization.** `proxy.ts` gates route groups by role; **every Server Action independently re-verifies ownership** (a restaurant mutates only its own data; a customer reads/cancels only their own orders). Never trust the route guard alone — this is the #1 risk in the PRD.

## Business rules the code must enforce

- **Single-restaurant cart** — one order = one restaurant; adding from another restaurant warns/clears the cart.
- **Price snapshotting** — `OrderItem` copies `name` + `priceCents` at purchase time; later menu edits must never change past orders.
- **Money is integer cents everywhere** (`priceCents`, `totalCents`) — no floats for money.
- **Payment gates the queue** — an order is created at `PLACED` but only appears in the restaurant's queue once the Stripe webhook flips `Payment` to `PAID`. Payment state is separate from order state.
- **Visibility** — customers see only `APPROVED` restaurants; new restaurants are `PENDING` until an admin approves them.

## Data model

Entities, relationships, lifecycle states, and the Prisma schema sketch are in `docs/food-delivery/PRD.md` Phase 5. Core entities: `User`, `Restaurant`, `MenuCategory`, `MenuItem`, `Address`, `Order`, `OrderItem`, `Payment`, `OrderStatusEvent`.

## Code style / conventions (from the PRD)

- **Server Components by default** for data reads; client components only where needed.
- **JSON endpoints use the envelope `{ ok, data, error }`.**
- **Cart state** = React context + `localStorage`, reconciled at checkout — no global state library.
- **SWR polling** only where status changes (order tracking, restaurant order queue) — never websockets/SSE.

## Workflows & conventions

- **Build order** (dependency-ordered, PRD Phase 8): auth/roles → DB schema → restaurant profile + admin approval → menu CRUD → discovery + cart → checkout + Stripe webhook → order state machine → restaurant queue → customer tracking/history → admin dashboard.
- **Testing intent:** Playwright E2E for the three happy paths (customer order, restaurant fulfillment, admin approval) + role-isolation negative tests; unit tests for the order state machine and money math. Deterministic seed data; no fixed sleeps — wait on status text/elements.
- **MVP "done":** customer goes discover → pay (Stripe test) → track → `DELIVERED` with no manual DB edits; no role can reach another's data; illegal transitions blocked; unpaid orders never reach the restaurant queue. Full criteria: PRD §7.16.

## Commands

- `pnpm dev` — start the dev server (Turbopack).
- `pnpm build` — production build.
- `pnpm start` — run the production build.
- `pnpm lint` — ESLint.
- `pnpm test` — Vitest unit tests (state machine, money math).
- `pnpm prisma migrate dev` — apply schema migrations locally.
- `pnpm prisma db seed` — load deterministic seed data (admin + sample restaurant).

## Things to avoid

- **Do not introduce** microservices, Kafka, Redis, event buses, Kubernetes, or websockets/SSE — explicit PRD complexity guardrails. Flag the user if a task seems to need one.
- **Do not relitigate the locked decisions** (restaurant-fulfilled delivery, Stripe test-mode, polling-not-push, three roles) without asking the user.
- **Do not enforce authorization in the route guard (`proxy.ts`) alone** — always re-check ownership in the Server Action.
- **Do not store money as floats.**
