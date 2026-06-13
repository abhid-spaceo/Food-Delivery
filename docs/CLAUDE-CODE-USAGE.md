# How Claude Code Was Used to Build QwikBite

> **Project:** QwikBite — a four-sided food-delivery marketplace (Customer / Restaurant / Driver / Admin), built as one Next.js 16 app.
> **Branch:** `Abhi/qwikbite` (branched from `main`, 2026-06-13). 78 commits on the branch as of Phase 5; full git log at a glance: `c98c8cb` (initial commit) → `a3ee547` (Phase 5 complete).
> **Purpose of this document:** explain HOW Claude Code was used — the workflow, skills, discipline, and tooling — not what QwikBite does. For what it does, read `docs/food-delivery/PRD.md`.

---

## 1. Overview

QwikBite was built using Claude Code as the primary implementation agent. The human developer (Abhi) directed work by describing screens and behavior; Claude Code read actual files, executed plans, wrote and ran tests, and proposed every commit for explicit approval.

Three [Superpowers skills](https://github.com/everything-claude-code/superpowers) were central to the workflow:

| Skill | What it does |
|---|---|
| `superpowers:writing-plans` | Produces a detailed, dependency-ordered, checkbox-driven implementation plan for one phase before any code is written |
| `superpowers:subagent-driven-development` | A controller Claude dispatches a fresh implementer subagent per task within a plan, keeping context fresh and scope tight |
| `superpowers:brainstorming` | Used when several reasonable approaches existed (e.g., stub-pay vs. real Stripe from day 1; worktree strategy for parallel phases) |

The controller + subagent model meant: the controller held the plan and phase context; each implementer subagent received a focused spec, produced its output, and was reviewed before the next task began. This kept individual context windows small and outputs high-quality.

---

## 2. Planning

### Discovery → PRD → roadmap

Work began by reading `docs/food-delivery/PRD.md` (the product requirements) and `docs/food-delivery/design/index.html` (35 screens across 4 roles in hi-fi HTML mockups). The `writing-plans` skill + a `brainstorming` session produced the master roadmap.

The roadmap document (`docs/superpowers/plans/2026-06-13-qwikbite-implementation-roadmap.md`) captures:

- **Phase 0** — the ~30%-built baseline (already done before this branch: auth, restaurant supply side, admin, order state machine minus `READY`, Stripe client stub). Verified by reading actual files, not assumed.
- **Phases 1–6** — dependency-ordered, each with an explicit goal, in/out-of-scope, key files, entry/exit criteria, and risks.
- **Key strategic decision:** a "stub-pay seam" — the stub (a dev button flips `Payment → PAID`) lets the full four-sided loop run on day 1 before Stripe is wired. When Stripe arrived in Phase 4, only the trigger changed; order creation was untouched.

### Per-phase implementation plans

Before implementation of each phase, the `writing-plans` skill produced a detailed task plan:

| Plan doc | Covers |
|---|---|
| `docs/superpowers/plans/2026-06-13-phase-1-lifecycle-driver-schema.md` | Phase 1 — READY state + Driver model + actor-aware state machine |
| `docs/superpowers/plans/2026-06-13-phase-1.5-design-system.md` | Phase 1.5 — Design system + visual retrofit of existing screens |
| `docs/superpowers/plans/2026-06-13-phase-2-customer-demand-stub-pay.md` | Phase 2 — Customer discovery, cart, checkout, stub-pay, tracking |
| `docs/superpowers/plans/2026-06-13-phase-3-driver-module.md` | Phase 3 — Driver module, atomic claim, earnings, admin driver approval |
| `docs/superpowers/plans/2026-06-14-design-system-gap-analysis.md` | Design pass — gap analysis vs. mockups + per-screen change list |
| `docs/superpowers/plans/2026-06-14-ui-changes-by-file.md` | Design pass — per-file manifest of exactly what changes |

Each plan was reviewed and approved by Abhi before a single line of implementation code was written.

### Decisions recorded in the roadmap

The roadmap explicitly records five decisions made before implementation started:

1. **Tests: test-as-you-go** — each phase exits only when its unit tests and E2E are green; no big-bang QA at the end.
2. **All four design extras in scope** — restaurant open/closed toggle, per-order prep time, driver online/offline toggle, multi-address book (Phase 5).
3. **Admin overrides: reassign + force-cancel** (Phase 5).
4. **Visual polish: style as we go + retrofit** — a design system (Phase 1.5) retrofits existing screens; every later phase builds to the mockups from the start. No "restyle everything at the end."
5. **Build-to-mockup** — `docs/food-delivery/design/*.html` is the visual source of truth for all new screens.

---

## 3. Codebase Analysis

Before writing code for any phase, Claude Code read the existing files it would touch. The three project-level rules in `.claude/rules/` formalize the gotchas discovered during this analysis:

### `.claude/rules/authorization.md` — Two-layer authorization

Reading `app/(restaurant)/restaurant/orders/[id]/actions.ts` and `auth.config.ts` revealed that the route guard (`proxy.ts`) only checks the caller's **role** — it does not prove ownership. The rule mandates that every Server Action independently re-verifies ownership (e.g., `requireOwnedRestaurant()`) and scopes writes with `updateMany … where owner` so a foreign ID silently matches zero rows. This is called out as the #1 risk in the PRD.

### `.claude/rules/data-access.md` — Generated Prisma client import path

This project generates the Prisma client into the repo at `lib/generated/prisma/`, not into `node_modules`. The rule prevents the natural instinct of writing `import { PrismaClient } from "@prisma/client"` (wrong) and enforces importing from `@/lib/generated/prisma/client` and using the singleton at `@/lib/db`. This was discovered by reading `lib/db.ts`.

### `.claude/rules/nextjs16-conventions.md` — Next.js 16 specifics

Reading `proxy.ts` (the route guard) and the existing route handlers revealed that this project uses Next.js 16 conventions that differ from most training data: `proxy.ts` replaces `middleware.ts`; `params` in pages and route handlers is a `Promise` requiring `await`; mutations are Server Actions (not Route Handlers, except the Stripe webhook and SWR-polled JSON).

### Baseline analysis before sequencing

The roadmap's "Current baseline" section was produced by reading ~15 actual source files to enumerate what was done vs. not done. This analysis caught one important detail: the seed created no orders, and the existing `e2e/restaurant.spec.ts` was documented as unable to pass without a paid order — so Phase 1 had to seed a PAID `PLACED` order, not rely on Phase 2's checkout.

---

## 4. Worktree Strategy

Phases 2 (customer) and 3 (driver) were built in parallel in separate git worktrees, each with its own Postgres database.

| Workspace | Folder | Branch | Database | Built in |
|---|---|---|---|---|
| Main | `/Users/sotsys165/Desktop/Food-Delivery` | `Abhi/qwikbite` | `fooddelivery_dev` | Phases 1, 1.5, design polish, Phase 4+5 |
| Customer | `.claude/worktrees/customer` | `Abhi/qwikbite-customer` | `fooddelivery_customer` | Phase 2 |
| Driver | `.claude/worktrees/driver` | `Abhi/qwikbite-driver` | `fooddelivery_driver` | Phase 3 |

**Why separate databases:** the worktrees' seed/test runs would collide on a single DB. Each worktree ran `pnpm db:seed` independently; the driver E2E in particular mutates order state and is earnings-count-sensitive, so it needed a clean, predictable starting state.

**Worktree creation gotcha:** the default `claude --worktree` command branches from `origin/HEAD` (= `main`), which lacked all Phase 1/1.5 work. Both worktrees were created manually off the feature branch:
```
git worktree add .claude/worktrees/customer -b Abhi/qwikbite-customer Abhi/qwikbite
git worktree add .claude/worktrees/driver   -b Abhi/qwikbite-driver   Abhi/qwikbite
```
This is recorded in `docs/superpowers/RESUME.md` for session recovery.

**Why the design-system work stayed on main:** Phase 1.5 and the subsequent design polish pass touched shared files (`app/globals.css`, `components/ui/*`, `components/app-header.tsx`, the admin and restaurant nav shells). Doing that work on the main worktree and having the customer/driver branches branch off it meant the design tokens were inherited automatically. Each worktree's screens were built against the design system from day one.

**Merge back:** after Phase 2 and Phase 3 were independently verified green (headed Playwright, `pnpm test:all`), the customer branch fast-forwarded cleanly into `Abhi/qwikbite`. The driver branch required a 3-way merge with two conflicts: `vitest.config.ts` (resolved by unioning both glob patterns and keeping both `DATABASE_URL` setups) and `playwright.config.ts` (resolved to a single `workers: 1` serial config). Merge commit `6ef01d6`. The combined gate (56 unit + 35 E2E headed) was verified green immediately after merge.

---

## 5. Task Execution

The `superpowers:subagent-driven-development` skill structures work as a controller dispatching implementer subagents. In practice on QwikBite:

1. **Controller** holds the phase plan, tracks which tasks are done (checkbox syntax in the plan docs), and decides what the next task is.
2. **Implementer subagent** receives a focused spec: the task from the plan, the relevant "context the implementer must know" section (which files to read, which patterns to mirror, what to avoid), and a short success check.
3. The implementer produces its output (code + tests); the controller runs the gate.
4. A **spec-compliance review subagent** checked that the output matched the plan's acceptance criteria; a **code-quality review subagent** checked for correctness, authorization gaps, and style issues.
5. If both reviews passed and the gate was green, the task was marked done and the next was dispatched.

Per-task commits were the norm: `feat(customer): pure immutable cart core + unit tests (Phase 2)` is one task; the next commit is the next task. This kept diffs small and reviewable.

**Gate between phases:** `pnpm test:all` = `pnpm test` (Vitest) + `pnpm build` (TypeScript clean) + `pnpm test:e2e` (Playwright headed). A phase was "done" only when `test:all` was green.

---

## 6. TDD Approach

Pure-logic modules were built test-first (Red → Green → Refactor):

| Module | Test file | Tests | What it tests |
|---|---|---|---|
| Order state machine | `lib/orders/state.test.ts` | 38 | Legal/illegal transitions; `isTerminal`; `nextStatuses`; actor authorization (restaurant, driver, customer, admin; `UnauthorizedActorError`) |
| Delivery fee constant | `lib/orders/fees.test.ts` | 2 | Positive integer; exact value matches seed fixtures |
| Cart core | `app/(customer)/_lib/cart.test.ts` | 10 | addItem, setQuantity, removeItem, subtotal, itemCount, immutability, single-restaurant conflict flag |
| Atomic claim contract | `lib/orders/claim.test.ts` | 3 | Count 1 = success; count 0 = `AlreadyClaimedError`; any non-positive = claimed |
| Earnings math | `app/(driver)/_lib/deliveries.test.ts` | 3 | Sum `deliveryFeeCents` over DELIVERED only; empty = 0; non-delivered excluded |
| Stripe event helper | `lib/orders/stripe-events.test.ts` | — | Webhook signature verification; `checkout.session.completed` → `markOrderPaid` |

The state machine tests were written first in Phase 1 before any implementation, locking the new `READY` edges and actor model as failing tests. The implementation then made them green. The cart tests were written before the cart context or UI existed, verifying immutability and business rules in isolation.

What the unit tests do NOT cover (reserved for Playwright E2E): the full HTTP/Server Action chain, multi-step user flows, cross-role permission enforcement via the UI, and real database behavior.

---

## 7. Refactoring

The design pass (after Phases 2–3 merged) introduced shared `components/ui/` primitives to consolidate duplicate components that had grown across roles:

| New shared primitive | Replaces / supersedes |
|---|---|
| `components/ui/badge.tsx` | Admin-local `app/(admin)/_components/badge.tsx` (status/role tones) |
| `components/ui/status-chip.tsx` | Restaurant `_components/status-badge.tsx`; ad hoc status coloring elsewhere |
| `components/ui/dialog.tsx` | Hand-rolled overlays in the menu editor and confirm flows |
| `components/ui/timeline.tsx` | Customer order tracking + driver delivery detail (two previously separate implementations) |
| `components/ui/veg-indicator.tsx` | Green-dot/red-triangle marker, previously inlined per screen |
| `components/ui/skeleton.tsx` | Shimmer loaders, previously absent on most screens |
| `components/ui/empty-state.tsx` | Branded empty/error block, previously absent or ad hoc |
| `components/ui/avatar.tsx` | Emoji/initials avatar used in driver and customer headers |

After the shared primitives existed, the admin badge and restaurant status-badge were re-pointed onto them (commit `refactor(ui): re-point admin badge + restaurant status-badge + item dialog onto shared primitives`, `5f790ee`). No behavior changed — only the import source. This is the scope limit: the refactor touched only what the design pass made redundant; pre-existing dead code was left in place and flagged to the user rather than silently cleaned.

---

## 8. Debugging

Several concrete bugs were found and fixed during the build. Each is cited with its commit.

### Route-guard collision — `/restaurants/[id]` vs `/restaurant` (`d3b89d3`)

`auth.config.ts` protected the prefix `/restaurant` (restaurant owner routes) by role. The customer-facing route `/restaurants/[id]` shares that prefix. Unauthenticated guests browsing a restaurant detail page were being redirected to sign in. Fix: tighten the guard to `/restaurant/` (trailing slash) so it only matches the role-scoped group and not the public browsing route.

### `Button asChild` Radix Slot single-child regression (`8fc69c2`)

The shared `Button` component gained a loading spinner and a disabled state that rendered conditionally inside the button. When `asChild` is true, Radix's `Slot` requires exactly one child — the spinner broke this. Fix: the spinner and disabled-only indicator are only rendered on real `<button>` elements (when `asChild` is false), keeping the Slot path always single-child.

### Playwright sign-in redirect race (`6cba967`, `d84c75a`)

E2E tests navigated to the sign-in page and filled credentials, but the next assertion ran before the post-login redirect completed. Fix: `await page.waitForURL(...)` after form submission rather than relying on timing. Applied consistently across customer and driver specs.

### Cart localStorage hydration race (`fix(lint): annotate intentional localStorage-hydration setState`, `ee1203a`)

React's strict-mode double-render and the server/client hydration split caused the cart context to read `localStorage` during the client hydration pass and immediately call `setState`, which React warns against. Fix: the `setState` call inside the hydration `useEffect` was annotated with a comment explaining why it is intentional (not a bug), and the ESLint rule was suppressed at that specific line.

### Accumulated test-data cruft — seed determinism (`fab188b`)

After multiple test runs that flipped `isAcceptingOrders` and driver `isOnline` to false (via the Phase 5 toggle features), later E2E runs were failing because the seed left those fields in whatever state the last test put them in. Fix: the seed's `update` clause for the restaurant and driver upserts explicitly resets `status: "APPROVED"`, `isAcceptingOrders: true`, and `isOnline: true` on every seed run, making the DB state deterministic regardless of prior test activity.

### Flaky driver redirect URL assertion (`a3ee547`)

A driver E2E test asserted `page.url()` would end in `/driver` after login. Depending on timing, the actual redirect could land at `/driver` (the root) or `/driver/pool` (if the pool page redirected further). Fix: the assertion was broadened to accept either URL with `expect(page.url()).toMatch(/\/driver(\/pool)?$/)`.

---

## 9. Testing

### Philosophy

The test pyramid was enforced deliberately:

- **Vitest unit tests** for pure logic (state machine, money math, cart, atomic-claim contract). These are fast, deterministic, and exhaustive — every edge of the transition graph, every cart invariant.
- **Playwright E2E** for critical user journeys and key role-isolation negatives. Not every permutation — the E2E suite is a canary for broken flows, not a duplicate of unit coverage.

### Playwright configuration

`playwright.config.ts` runs:
- Chromium only (Desktop Chrome profile).
- `workers: 1` — single serial worker because one shared Postgres database backs all specs. Parallel workers would race over the same orders.
- `fullyParallel: false` for the same reason.
- `retries: 0` — no silent retries; a flake must be fixed.
- `reuseExistingServer: true` — reuses a running `pnpm dev` process if present.

**Headed (visible Chromium) is a hard user requirement.** All Playwright runs in this project use `--headed`. This was set as a standing rule in Claude memory and enforced at every phase gate.

### Seed before every E2E run

`pnpm db:seed` (idempotent upserts) restores the deterministic fixture state before any E2E run:
- Admin, restaurant owner (Mario's Pizza, APPROVED), customer (Maya), approved driver (Dev), second restaurant (Spice Hub, APPROVED), second driver.
- One PAID `PLACED` order (for the restaurant queue E2E to advance).
- One PAID unclaimed `READY` order (for the driver pool E2E to claim).
- The seed resets `isAcceptingOrders: true` and `isOnline: true` to undo any state mutations from prior test runs.

For the driver E2E (Phase 3 onward), orders must be deleted and reseeded (not just reseeded additively) because claim and deliver consume the READY orders — accumulated orders from previous runs would cause earnings-count assertions to fail.

### Phase gates

| Phase | Vitest | Playwright | Build |
|---|---|---|---|
| Phase 1 gate | 38 ✅ | 27 ✅ (4 specs) | clean |
| Phase 2 gate (customer worktree) | 50 ✅ | 31 ✅ (5 specs) | clean |
| Phase 3 gate (driver worktree) | 44 ✅ | 31 ✅ (5 specs) | clean |
| Combined post-merge gate | 56 ✅ | 35 ✅ | clean |

`pnpm test:all` = `pnpm test && pnpm build && pnpm test:e2e`. No phase was marked done until `test:all` was green.

### Test-case matrices

Before running tests, a written test-case matrix was produced for each phase:

| Matrix | Covers |
|---|---|
| `docs/superpowers/test-cases/2026-06-13-phase-1-test-cases.md` | State machine graph + actor authz + restaurant transitions + payment gate + role isolation + auth |
| `docs/superpowers/test-cases/2026-06-13-phase-1-test-report.md` | Execution results, per-test pass/fail, matrix cross-reference |
| `docs/superpowers/test-cases/2026-06-13-phase-2-test-cases.md` | Delivery fee + cart core + single-restaurant rule + checkout money math + stub-pay + tracking + cancel |
| `docs/superpowers/test-cases/2026-06-13-phase-2-test-report.md` | Phase 2 execution results |
| `docs/superpowers/test-cases/2026-06-13-phase-3-test-cases.md` | Atomic claim contract + earnings math + driver pool + PENDING-gate + already-claimed negative |
| `docs/superpowers/test-cases/2026-06-13-phase-3-test-report.md` | Phase 3 execution results |

### E2E spec files

| Spec | What it covers |
|---|---|
| `e2e/auth.spec.ts` | Sign-in (all 4 roles), sign-up (customer + driver), duplicate email, wrong password, unauthenticated redirect |
| `e2e/restaurant-fulfillment.spec.ts` | Accept → prepare → ready; reject; payment gate (unpaid order absent from queue); cross-tenant isolation |
| `e2e/customer.spec.ts` | Browse → add to cart → checkout → stub-pay → tracking timeline; cancel before accept; ownership 404 |
| `e2e/driver.spec.ts` | Claim → deliver; already-claimed negative; PENDING driver cannot claim; admin approve driver |
| `e2e/admin.spec.ts` | Approve/suspend restaurant; admin overview KPIs |
| `e2e/role-isolation.spec.ts` | Cross-role route access; customer cannot reach /admin; driver cannot reach /restaurant |
| `e2e/phase5b-gating.spec.ts` | Closed-store blocks ordering; offline-driver blocks claim; seed determinism for toggle resets |

---

## 10. Documentation

Documentation was written after implementation (not before), generated to describe what was actually built:

- `docs/food-delivery/PRD.md` — the product requirements document, pre-existing, extended with the 4-role driver design. The source of truth for what to build.
- `docs/food-delivery/design/*.html` — the five hi-fi mockup HTML files (index, admin, restaurant, customer, driver), used as the visual source of truth during the design pass.
- `docs/superpowers/plans/*.md` — all phase plans and design manifests, written before each phase's implementation.
- `docs/superpowers/test-cases/*.md` — test matrices and execution reports per phase.
- `docs/superpowers/RESUME.md` — the session handoff document (intentionally untracked — not committed). Contains the worktree table, DB assignments, phase status, standing rules, and a "how to resume" recipe. Read first at the start of every new Claude Code session.
- `docs/CLAUDE-CODE-USAGE.md` — this file.

The `docs/modules/` directory exists for planned per-module architecture notes; population is deferred.

---

## 11. Review Process

### Per-task two-stage review

Every implementation task was reviewed in two passes before being accepted:

1. **Spec compliance review:** did the output match the plan's acceptance criteria? Were the key files touched? Were the out-of-scope files left alone? Were the patterns (two-layer authz, Prisma import path, Server Actions not Route Handlers) followed?
2. **Code quality review:** correctness bugs, authorization gaps (was ownership re-verified in every action?), immutability violations (was any state mutated in place?), dead imports left by the change, money as floats.

### Controller verification

After a subagent's output, the controller independently re-ran the gate (`pnpm test:all`) and did a browser check on the affected screens. "Verified" meant the gate was green and the flow worked in a headed Chromium browser — not just reading the code.

### Confirm-before-commit discipline

The standing rule throughout the project: **never commit or push without Abhi's explicit confirmation.** After each task, Claude Code left changes uncommitted, showed the proposed commit message and affected files, and waited for "yes." This rule is recorded in Claude memory (`always-confirm-before-commit`) and in `docs/superpowers/RESUME.md`.

**Exception for the autonomous overnight push:** For the design polish pass and Phase 4/5 work, Abhi explicitly overrode this rule for a single autonomous run — authorizing Claude Code to commit per-task on the feature branch without pausing for per-commit confirmation, with the understanding that (a) no merges or pushes to `main` would occur, (b) the full headed gate would be run at the end, and (c) all work stayed on `Abhi/qwikbite`. The confirm-before-push rule was maintained; `main` was never touched autonomously.

### What was never done autonomously

- Merging or pushing to `main`.
- Amending existing commits (new commits only).
- Bypassing pre-commit hooks (`--no-verify`).
- Running destructive git operations (`reset --hard`, `checkout .`, `clean -f`) without explicit instruction.
- Expanding scope beyond the approved plan — any out-of-plan file touch required stopping and asking first.
