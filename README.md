# Food Delivery Platform

A solo-buildable, three-sided **food-delivery marketplace** — Customer, Restaurant, and Admin — built as **one Next.js app** with role-scoped route groups. Delivery is restaurant-fulfilled: no courier app, no GPS, no dispatch engine.

> **Status:** implementation in progress (Slice 1 — Foundation).
> Read [`docs/food-delivery/PRD.md`](docs/food-delivery/PRD.md) before building anything.

## Tech stack (fixed — do not substitute)

- **Language:** TypeScript
- **Framework:** Next.js 16 (App Router) + React 19
- **Database:** PostgreSQL via Prisma 7
- **UI:** Tailwind v4 + shadcn/ui
- **Auth:** Auth.js (NextAuth v5), role-bearing sessions
- **Payments:** Stripe (test mode only)
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Deploy:** Vercel (+ Vercel Postgres / Neon)

> ⚠️ This is **Next.js 16 / React 19 / Tailwind v4** — newer than typical training data. See [`AGENTS.md`](AGENTS.md) and consult the bundled docs in `node_modules/next/dist/docs/` before assuming older patterns.

## Getting started

This project uses **pnpm**.

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env        # then fill in DATABASE_URL, AUTH_SECRET, STRIPE_SECRET_KEY

# 3. Set up the database (apply migrations, then load seed data)
pnpm prisma migrate dev
pnpm db:seed                # admin + a sample restaurant

# 4. Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Commands

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Start the dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit tests (state machine, money math) |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm prisma migrate dev` | Apply schema migrations locally |
| `pnpm db:seed` | Load deterministic seed data |

## Architecture (the big picture)

- **One app, three role-scoped route groups** under `app/(customer|restaurant|admin|marketing)/` — one deploy, one DB, one auth config.
- **Two-layer authorization:** `proxy.ts` / middleware gates route groups by role; **every Server Action independently re-verifies ownership.** Never trust the route guard alone.
- **Mutations are Server Actions.** Route Handlers are the exception — only the Stripe webhook and JSON consumed by SWR polling hooks.
- **The order state machine lives in `lib/orders/state.ts`** — the single source of truth for transitions, so illegal jumps (e.g. `PLACED → DELIVERED`) are impossible.
- **Every transition appends an `OrderStatusEvent`** — the audit trail and the customer's tracking timeline.

### Business rules the code enforces

- **Single-restaurant cart** — one order = one restaurant.
- **Price snapshotting** — `OrderItem` copies name + price at purchase; later menu edits never change past orders.
- **Money is integer cents everywhere** — no floats.
- **Payment gates the queue** — an order is `PLACED` immediately but only enters the restaurant queue once the Stripe webhook flips `Payment` to `PAID`.
- **Visibility** — customers see only `APPROVED` restaurants; new restaurants are `PENDING` until an admin approves them.

## Documentation

- [`docs/food-delivery/PRD.md`](docs/food-delivery/PRD.md) — product research, PRD, data model, architecture, and the phased implementation plan.
- [`docs/food-delivery/WIREFRAMES.md`](docs/food-delivery/WIREFRAMES.md) — all 17 screens, user flows, and UX spec.
- [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) — guidance for working in this repo.
