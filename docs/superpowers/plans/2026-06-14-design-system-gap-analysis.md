# Design-System Gap Analysis & Remaining Work (extends Phase 1.5)

> **Status: analysis + proposal. No code changed yet.** This file is the change-list
> the user asked for. It complements — does not replace — the existing
> [`2026-06-13-phase-1.5-design-system.md`](./2026-06-13-phase-1.5-design-system.md).

**Date:** 2026-06-14
**Branch:** `Abhi/qwikbite` (recommended — see "Git worktree" section at the end)
**Source of truth:** hi-fi mockups in `docs/food-delivery/design/*.html`; UX in `docs/food-delivery/WIREFRAMES.md`.
**Constraint (unchanged from Phase 1.5):** visual only — do **not** change behavior, routes,
data, or any text/accessible names E2E tests query (`"Sign in"`, `"Accept"`, `"Start preparing"`,
`"Mark ready"`, status labels, `"Open"`, etc.). Full suite must stay green after each step.

---

## 1. Where we are now

| Phase 1.5 task | State |
|---|---|
| Task 1 — base brand palette + Inter font | ✅ committed (`feat(ui): brand design tokens + Inter font`) |
| Task 2 — shared header + admin/restaurant shells | 🟡 in progress (uncommitted: `app-header`, `admin-nav`, admin `layout`, `restaurant-nav`, `dashboard-shell`) |
| Task 3 — KPI cards + tables | ⬜ pending |
| Task 4 — auth + per-screen sweep + gate | ⬜ pending |

**This document adds what Phase 1.5 did *not* cover**, discovered by comparing the live app
(main branch) against the mockups + wireframes.

---

## 2. Gap findings (built vs. intended)

### 2A. Token layer — incomplete
`app/globals.css` has the base shadcn palette but is **missing the mockups' semantic system**:

| Token | Mockup value | In `globals.css`? |
|---|---|---|
| brand-dark | `#E82E4D` | only as `--accent-foreground` (unnamed) |
| brand-soft | `#FFEDF0` | only as `--accent` (unnamed) |
| brand gradient | `linear-gradient(135deg,#FF6B81,#FF2E54)` | ❌ missing |
| success / success-soft | `#12B886` / `#E6F8F1` | ❌ missing |
| warning / warning-soft | `#E8890C` / `#FDF1DF` | ❌ missing |
| info / info-soft | `#3B82F6` / `#EAF2FE` | ❌ missing |
| shadow scale | `--sh: 0 12px 34px rgba(20,19,26,.12)`, `--sh-sm: 0 2px 10px rgba(20,19,26,.06)` | ❌ missing |
| base font size | `14px` | ❌ (Tailwind default 16px) |
| card radius | `16px` | 🟡 `~14px` (`--radius: 0.875rem`) |
| button shape | **pill** (`999px`) | ❌ `rounded-md` |

### 2B. Missing shared components (block multiple screens)
- **`Badge`** in `components/ui/` — only an admin-local one exists; needed app-wide.
- **`Dialog`/Modal** primitive — menu editor hand-rolls an overlay; cart-conflict warning,
  reject-reason, suspend-confirm all need one.
- **Status timeline** — order tracking (customer) + driver delivery both need the dot-and-line tracker.
- **Veg / non-veg indicator** — green-dot / red-triangle marker on every menu item.
- **Skeleton loaders + empty states** — wireframes require loading/empty/error on *every* data screen.

### 2C. Screen-level gaps
| Screen | Verdict | Note |
|---|---|---|
| Landing (`(marketing)/page.tsx`) | 🔴 placeholder | no hero / value prop |
| Browse (`(customer)/browse`) | 🔴 placeholder | lives in `qwikbite-customer` worktree (Phase 2) |
| Sign up — role picker | 🟡 raw radios | mockup uses selector chips |
| Menu manager | 🟡 functional | no veg indicators / thumbnails |
| Restaurant profile | 🟡 bare form | no store-status toggle |
| Admin users | 🟡 | missing role tabs |
| Cart / checkout / tracking | 🔴 not on main | in `qwikbite-customer` worktree |

---

## 3. Proposed changes (the change-list)

Ordered by **risk**, lowest first. Each step ends with build + full test suite (no regression).

### Step A — additive tokens (zero blast radius) ✅ safe to do first
**File:** `app/globals.css` only.
- [ ] Add to the `@theme inline` block (new `--color-*` tokens so Tailwind exposes `bg-success` etc.):
  `--color-success`, `--color-success-soft`, `--color-warning`, `--color-warning-soft`,
  `--color-info`, `--color-info-soft`, `--color-brand-dark`, `--color-brand-soft`.
- [ ] Add raw values to `:root` (light) and grayscale/oklch equivalents to `.dark`.
- [ ] Add `--gradient-brand` and the `--shadow-sm` / `--shadow-card` scale.
- **What can break:** nothing — these variables are unused until a component references them,
  so no existing screen changes. (Tailwind v4: an unused token has zero rendered effect.)
- **Verify:** `pnpm build` + `pnpm test` green; no visual diff expected.

### Step B — sweeping cosmetics (whole-app blast radius) ⚠️ needs explicit OK + browser check
**Files:** `app/globals.css`, `components/ui/button.tsx`.
- [ ] Pill buttons: `button.tsx` cva root `rounded-md` → `rounded-full` (revisit `icon` size — full pill makes it circular; decide square-12px vs circle).
- [ ] Base font → 14px (rescales **all** rem text + spacing ~12.5%; densest screens — admin tables, restaurant queue — re-checked for wrapping).
- [ ] Card radius `--radius` `0.875rem` → `1rem` (16px).
- **What can break:** `globals.css` + `Button` are the **most shared** code in the app — every
  screen in all four roles, and both worktrees inherit them. Watch admin tables / queue for reflow.
- **Verify:** browser pass on `/admin`, `/restaurant`, `/signin`, `/signup` before/after; full suite green.

### Step C — shared primitives (unblocks screen work)
- [ ] `components/ui/badge.tsx` — variants `brand`/`success`/`warning`/`info`/`gray` using Step A tokens.
- [ ] `components/ui/dialog.tsx` — accessible modal (focus trap, Esc, overlay) per frontend-patterns.
- [ ] `components/ui/timeline.tsx` — vertical status tracker (done/current/pending states).
- [ ] `components/ui/veg-indicator.tsx` — green-dot / red-triangle marker.
- [ ] `components/ui/skeleton.tsx` + a shared empty-state block.
- **What can break:** new files — additive. Refactoring the admin-local Badge to the new one is the only touch-point; do that as its own step.
- **Verify:** each used on one screen, then suite green.

### Step D — screen sweeps (one screen per step, per mockup)
Landing → Sign-up role chips → Restaurant profile toggle → Admin role tabs → Menu veg indicators.
Customer/driver screens happen **in their own worktrees** (they live there).
- **What can break:** per-screen only; preserve test-queried text/names.
- **Verify:** browser vs. mockup + suite green, screen by screen.

---

## 4. Git worktree — can we use one for this? (researched)

**Short answer: no — keep the design-system foundation on `Abhi/qwikbite` (the main worktree).
Worktrees are the right tool for the role features, the wrong tool for shared tokens.**

### What the repo actually has
```
Abhi/qwikbite                          ← main worktree (Phase 1.5 retrofit in progress, UNCOMMITTED)
.claude/worktrees/customer  → Abhi/qwikbite-customer  (Phase 2)
.claude/worktrees/driver    → Abhi/qwikbite-driver    (Phase 3)
```
`.claude/worktrees/` is gitignored. A git worktree is a second working copy of the **same repo**
on a **different branch** (you cannot check out one branch in two worktrees).

### Why a worktree fits the role modules but not the design system
- **Role modules** (`customer`, `driver`) touch **disjoint, role-scoped files** under
  `app/(customer|driver)/…`. Parallel branches rarely collide → isolation is a win.
- **Design tokens** touch **`app/globals.css` + `components/ui/*`** — the *shared* layer **every**
  branch depends on. Isolating them defeats the purpose: the change has to land where everyone
  inherits it. Putting it on a side branch means merging the same shared-file edits into 3 branches,
  inviting conflicts in exactly the files most likely to conflict.

### Two more concrete reasons to stay on `Abhi/qwikbite`
1. **Phase 1.5 is already mid-flight here** — Tasks 2–4 are uncommitted in this worktree.
   Spinning up a new design worktree would strand that work (a worktree starts from a *commit*,
   not from your uncommitted edits). Finish where the work already lives.
2. **Project rule (memory):** *"don't start worktree work for the next phase until ALL tasks of the
   previous phase are done."* Design system = finishing Phase 1.5, not starting a new parallel phase.

### How customer/driver branches get these tokens
They **rebase/merge from `Abhi/qwikbite`** (which they must do before final integration anyway).
Because Step A is purely additive, that sync is low-conflict; Step B's shared-file edits are the
ones to land **before** those branches do their next sync, so they inherit a settled token layer.

### When a worktree *would* be justified (not now)
A throwaway design **spike** — e.g. trying a bold restyle you might discard — isolated from the
in-progress retrofit. That's exploratory, not this foundational work.

---

## 5. Verification model (whole document)
Styling work → no new unit tests. Each step gated by: (a) `pnpm build` + `pnpm lint` clean,
(b) full suite green (`pnpm test && pnpm test:e2e`, reseed first), (c) **headed** browser compare
vs. the mockup. Preserve every test-queried string.

## 6. Open decisions for the user
1. Proceed with **Step A** now (safe, additive)? 
2. For **Step B**, confirm the sweeping changes (pill buttons / 14px base / 16px radius) — and
   whether `icon` buttons should stay square.
3. Sequence Steps C–D now, or after Phase 1.5 Tasks 2–4 are committed?
