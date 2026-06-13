# UI / Design Change Manifest — organized by file

> **Single source of truth for the UI upgrade.** Lists every file we'll touch and exactly what
> changes in it. Consolidates the discussion + the two companion docs:
> [`...ui-upgrade-all-screens.md`](./2026-06-14-ui-upgrade-all-screens.md) (per-screen intent) and
> [`...design-system-gap-analysis.md`](./2026-06-14-design-system-gap-analysis.md) (gap + worktree rationale).
>
> **Status: planning only — no code written yet.**

**Date:** 2026-06-14
**Ambition:** push *beyond* the hi-fi mockups (`docs/food-delivery/design/*.html`) — match structure, add depth/motion/imagery.

**Decisions locked (2026-06-14):**
- **Start point = Foundation first** — build §1 tokens + §2 shared `components/ui/*` before any screen. Nothing visible changes in this first chunk; it's the reusable layer every screen pulls from.
- **Imagery = gradient-mesh + emoji fallback** (no real-photo assets). A food emoji on a brand gradient frame, as the mockups do — ships with zero assets. Real photos are a deferred follow-up (would need a licensed source / seed image URLs / upload + storage). This convention applies to every image slot (restaurant cards, detail banner, menu thumbnails, order history, avatars).
**Hard rule (every file):** visual only. Never change behavior, routes, data, or any text/accessible
name the E2E suite queries. After each file's work: `pnpm build` + full suite green (reseed first) + headed browser check.

**Legend** — Status: 🔴 bare · 🟡 functional-but-plain · 🟢 decent (polish) · ✨ NEW file.
Risk: 🟥 high blast radius (many screens inherit) · 🟧 medium · 🟩 contained.
Branch: **M** = `Abhi/qwikbite` · **C** = `qwikbite-customer` worktree · **D** = `qwikbite-driver` worktree.

---

## 1. Foundation — `Abhi/qwikbite` (M)

| File | Status | Changes | Preserve / Risk |
|---|---|---|---|
| `app/globals.css` | 🟡 | **(additive)** add semantic tokens `success/warning/info` + soft tints; name `brand-dark`/`brand-soft`; add `--gradient-brand`; 3-tier elevation (`--shadow-sm/-card/-overlay`); motion tokens (`--ease`, `--dur-fast`, `--dur`). Expose all via `@theme inline`. **(sweeping, separate step)** base font→14px, `--radius`→1rem (16px). | Additive part breaks nothing. Sweeping part = 🟥 rescales all rem + corners app-wide. |
| `app/layout.tsx` | 🟢 | Inter + metadata already done (Phase 1.5). Optional: add a documented type-scale comment; no functional change. | 🟩 |

---

## 2. Shared UI primitives — `components/ui/` (M) — 🟥 every screen + both worktrees inherit

| File | Status | Changes |
|---|---|---|
| `components/ui/button.tsx` | 🟡 | Pill shape (`rounded-md`→`rounded-full`); add `gradient` variant (uses `--gradient-brand`); loading-spinner state; keep `icon` size rounded-xl (not full circle). |
| `components/ui/card.tsx` | 🟡 | Elevation + `hover:shadow-card hover:-translate-y-0.5 transition` opt-in; keep sub-components' API. |
| `components/ui/input.tsx` | 🟢 | Focus ring polish to brand; consistent height/padding. |
| `components/ui/label.tsx` | 🟢 | Minor weight/spacing only. |
| `components/ui/badge.tsx` | ✨ | Promote shared Badge: variants `brand/success/warning/info/gray` from §1 tokens. Replaces admin-local + restaurant status-badge usage. |
| `components/ui/status-chip.tsx` | ✨ | Order/payment/approval status pill mapped to semantic tokens (wraps Badge). |
| `components/ui/dialog.tsx` | ✨ | Accessible modal (focus trap, Esc, scale-in overlay). Replaces hand-rolled overlays. |
| `components/ui/timeline.tsx` | ✨ | Vertical dot-and-line status tracker (done/current/pending). |
| `components/ui/veg-indicator.tsx` | ✨ | Green-dot / red-triangle marker. |
| `components/ui/skeleton.tsx` | ✨ | Shimmer loading block. |
| `components/ui/empty-state.tsx` | ✨ | Branded empty + error/retry block (icon + message + optional action). |
| `components/ui/avatar.tsx` | ✨ | Emoji/initials avatar w/ gradient ring (profiles, driver/customer headers). |

---

## 3. Shared chrome — `Abhi/qwikbite` (M) — 🟥 used across roles

| File | Status | Changes | Preserve |
|---|---|---|---|
| `components/app-header.tsx` | 🟡 (Task 2 WIP) | Logo lockup (gradient QB mark + wordmark); translucent `backdrop-blur` + soft border; keep session/sign-out on right. | Keep `<Link href="/">`, `SignOutButton`. |
| `components/sign-out-button.tsx` | 🟢 | Button variant alignment only. | Keep action/text. |
| `app/(admin)/admin/layout.tsx` | 🟡 (Task 2 WIP) | Dark sidebar rail (`#15141a`), sticky, rounded. | — |
| `app/(admin)/_components/admin-nav.tsx` | 🟡 | Active=brand, inactive=white/70 hover; lucide icons. | Keep `LINKS`, labels. |
| `app/(restaurant)/_components/dashboard-shell.tsx` | 🟡 | Light card sidebar; max-w container; title styling. | Keep layout/children. |
| `app/(restaurant)/_components/restaurant-nav.tsx` | 🟡 | Align active/inactive to admin-nav light variant; icons. | Keep links/labels. |

---

## 4. Admin — `Abhi/qwikbite` (M)

| File | Status | Changes | Preserve |
|---|---|---|---|
| `app/(admin)/_components/stat-card.tsx` | 🟡 | Icon + large `tabular-nums` value + delta; hover lift. | Keep `label`/`value` props. |
| `app/(admin)/_components/table.tsx` | 🟡 | Uppercase muted headers, zebra/hover rows, sticky header, aligned numerics. | Keep `Table/THead/TBody/TR/TH/TD` API. |
| `app/(admin)/_components/badge.tsx` | 🟡 | Re-point to shared `ui/badge` (keep export so pages don't change) or thin wrapper. | Keep status→color mapping. |
| `app/(admin)/_components/filter-bar.tsx` | 🟢 | Style as proper tab chips; active = brand. | Keep query-param behavior. |
| `app/(admin)/admin/page.tsx` | 🟡 | KPI grid w/ new StatCards; 2-col "Pending approvals" + "Orders by state"; recent-orders table polish. | Keep data/links. |
| `app/(admin)/admin/restaurants/page.tsx` | 🟢 | Status tabs; thumbnail + StatusChip; Approve/Suspend w/ confirm Dialog. | Keep action button text. |
| `app/(admin)/admin/orders/page.tsx` | 🟢 | Status tabs/filter; row hover; inline detail panel polish; `tabular-nums`. | Keep filter/`?id=` behavior. |
| `app/(admin)/admin/users/page.tsx` | 🟡 | Role tabs + search; role-colored Badge; status chip; suspend confirm Dialog. | Keep search `?q=`. |
| `app/(admin)/admin/drivers/page.tsx` | 🟡 | *(exists on D)* same treatment as restaurants table. | Keep approve/suspend text. |

---

## 5. Restaurant — `Abhi/qwikbite` (M)

| File | Status | Changes | Preserve |
|---|---|---|---|
| `app/(restaurant)/_components/queue-board.tsx` | 🟢 | Column headers w/ count chips; spacing/skeleton/empty polish. | Keep SWR polling + fallback. |
| `app/(restaurant)/_components/order-actions.tsx` | 🟢 | Button variants/icons; sticky action bar. | **Keep exact action text** (`Accept`/`Reject`/`Start preparing`/`Mark ready`…). |
| `app/(restaurant)/_components/status-badge.tsx` | 🟡 | Re-point to `ui/status-chip`. | Keep status **labels** (`Placed`/`Ready`/…). |
| `app/(restaurant)/_components/item-form-dialog.tsx` | 🟡 | Rebuild on `ui/dialog`; field polish. | Keep form fields/submit. |
| `app/(restaurant)/restaurant/page.tsx` (queue) | 🟢 | Richer OrderCard (PAID chip, time-ago, total). | Keep `Open` links. |
| `app/(restaurant)/restaurant/orders/[id]/page.tsx` | 🟢 | Add status Timeline; customer/address block w/ icons. | Keep `No further actions for this order.` + actions. |
| `app/(restaurant)/restaurant/menu/page.tsx` | 🟡 | Item rows w/ thumbnail + VegIndicator; availability toggle; Dialog add/edit; category counts. | Keep CRUD actions. |
| `app/(restaurant)/restaurant/profile/page.tsx` | 🟡 | Sectioned card form; store-status toggle; read-only approval StatusChip. | Keep fields/save. |

---

## 6. Marketing + Auth — `Abhi/qwikbite` (M)

| File | Status | Changes | Preserve |
|---|---|---|---|
| `app/(marketing)/page.tsx` | 🔴 | Full hero: gradient headline band, value prop, dual CTA, 3 feature tiles w/ icons, footer. | Keep CTA targets + visible link text. |
| `app/(auth)/_components/auth-shell.tsx` | 🟢 | Logo lockup above card; off-white bg; centered. | — |
| `app/(auth)/signin/page.tsx` + `signin-form.tsx` | 🟢 | Gradient submit; styled inline error. | **Keep `Email`/`Password` labels + `Sign in` button.** |
| `app/(auth)/signup/page.tsx` + `signup-form.tsx` | 🟡 | Role selector as chips/cards w/ icons; password hint. | **Keep field labels + `Create account` button.** |

---

## 7. Customer — `qwikbite-customer` worktree (C) — built in Phase 2, upgrade pass

| File | Status | Changes | Preserve |
|---|---|---|---|
| `app/(customer)/layout.tsx` | 🟡 | Customer top-nav shell: search + cart badge + account. | Keep nav routes. |
| `app/(customer)/_components/cart-button.tsx` | 🟡 | Badge count chip; cart icon. | Keep cart state read. |
| `app/(customer)/_components/add-to-cart-button.tsx` | 🟡 | Qty stepper styling; add animation. | Keep add/update logic. |
| `app/(customer)/_lib/cart-context.tsx` | 🟢 | No visual change (logic). | Do not touch behavior. |
| `app/(customer)/browse/page.tsx` | 🟡 | Sticky search + cuisine chip rail; restaurant card grid (image frame, ⭐rating, time+fee, promo, hover lift); skeleton/empty/error. | Keep data + links. |
| `app/(customer)/restaurants/[id]/page.tsx` | 🟡 | Banner image; sticky category sidebar; menu items w/ VegIndicator + qty; sticky cart panel / mobile bottom bar. | Keep add-to-cart + single-restaurant rule. |
| `app/(customer)/cart/page.tsx` | 🟡 | Line items w/ steppers; single-restaurant warning Dialog; bill breakdown; gradient checkout CTA. | Keep totals/behavior. |
| `app/(customer)/checkout/page.tsx` | 🟡 | Two-col address radios + Stripe; summary card; pay loading state. | Keep Stripe flow/text. |
| `app/(customer)/orders/page.tsx` | 🟡 | Active/Past card lists w/ thumbnail, StatusChip, amount, Track/View. | Keep links. |
| `app/(customer)/orders/[id]/page.tsx` | 🟡 | Tracking layout: dark "arriving" header, items, address. | Keep data. |
| `app/(customer)/orders/[id]/_components/order-tracker.tsx` | 🟢 | Rebuild on `ui/timeline`; keep polling. | **Keep status labels + poll behavior.** |
| `.../_components/cancel-order-button.tsx` | 🟢 | Button variant only. | **Keep `Cancel` gating + text.** |
| `.../_components/mark-paid-button.tsx` | 🟢 | Button variant only (test helper). | Keep action/text. |
| `.../_components/clear-cart-on-mount.tsx` | 🟢 | No visual change. | Do not touch. |

---

## 8. Driver — `qwikbite-driver` worktree (D) — built in Phase 3, upgrade pass

| File | Status | Changes | Preserve |
|---|---|---|---|
| `app/(driver)/_components/driver-shell.tsx` | 🟡 | Mobile-web shell: top bar + online/offline status pill. | Keep layout/children. |
| `app/(driver)/_components/driver-nav.tsx` | 🟡 | Active/inactive styling + icons. | Keep links/labels. |
| `app/(driver)/_components/pool-board.tsx` | 🟡 | Order cards w/ route mini-viz, fee, `Ready` chip, Claim; live note; empty state. | Keep polling + claim. |
| `app/(driver)/driver/page.tsx` | 🟡 | Dashboard/landing polish. | Keep data. |
| `app/(driver)/driver/pool/page.tsx` | 🟡 | Pickup-pool layout w/ pool-board; empty/error. | Keep data. |
| `app/(driver)/driver/order/[id]/page.tsx` | 🟡 | Route visualization (pickup/drop dots+line); "you'll earn"; race-condition warning card. | Keep claim/deliver flow. |
| `.../_components/claim-button.tsx` | 🟢 | Button variant only. | **Keep `Claim` text + atomic behavior.** |
| `.../_components/deliver-button.tsx` | 🟢 | Gradient CTA variant. | **Keep `Mark as delivered` text + behavior.** |
| `app/(driver)/driver/earnings/page.tsx` | 🟡 | Gradient total card + 3 stat tiles + display-only note. | Keep computed totals. |
| `app/(driver)/driver/deliveries/page.tsx` | 🟡 | History cards w/ Delivered chip + amount. | Keep data. |

---

## 9. New files to create (✨) — all on M, inherited by C/D
`components/ui/badge.tsx` · `status-chip.tsx` · `dialog.tsx` · `timeline.tsx` · `veg-indicator.tsx` ·
`skeleton.tsx` · `empty-state.tsx` · `avatar.tsx` · `image-frame.tsx` (gradient-mesh + emoji helper)

---

## 10. Cross-cutting (verify on every screen)
- **Imagery = gradient-mesh + emoji** (locked): every image slot renders a food emoji on a brand-gradient
  frame (rounded 16px) — a small shared helper (e.g. `components/ui/image-frame.tsx`, ✨) so all screens
  are consistent and a future real-photo swap is one place. No external image assets in this pass.
- Loading (Skeleton) / empty (EmptyState) / error+retry states on all data screens.
- Responsive: desktop multi-col → tablet drawer → mobile single-col + hamburger / bottom cart bar.
- Motion respects `prefers-reduced-motion`.
- Accessibility: Dialog focus trap, Timeline aria, contrast ≥ AA, preserved labels.

---

## 11. Risk hotspots & order of operations
1. **🟥 Foundation + `components/ui/*`** land on **M first** — every screen and both worktrees inherit. Change once, verify broadly. C/D pick them up on their next rebase from M.
2. Then **M screens** (marketing → auth → admin → restaurant).
3. Then **C** screens, then **D** screens, in their own worktrees.
4. **Per file:** preserve test-queried strings (called out above); `pnpm build`+`lint` clean; full suite green (reseed); headed browser compare vs. mockup.

## 12. Decisions
- ✅ **Start point: Foundation first** (§1 tokens + §2 `components/ui/*`).
- ✅ **Imagery: gradient-mesh + emoji** (shared `image-frame` helper; real photos deferred).
- ⬜ **Execution mode** — still open: inline (I build + stop for your review per chunk) vs. subagent per file. *Recommended: inline for Foundation, since the §1/§2 pieces are interdependent and 🟥 high-risk — best reviewed together.*

---

## 13. Foundation work order (the first chunk we'll build)
Concrete sequence for "Foundation first". Each step ends with `pnpm build` + `pnpm test` green
(no E2E impact expected — these are additive/visual). **STOP for review before commit.**

1. **`app/globals.css`** — additive tokens only (semantic colors + soft tints, `brand-dark`/`brand-soft`,
   `--gradient-brand`, 3-tier shadow scale, motion tokens) exposed via `@theme inline`.
   *(Defer the sweeping 14px base + 16px radius to a separate, explicitly-approved step — 🟥.)*
2. **`components/ui/button.tsx`** — pill + `gradient` variant + loading state.
3. **`components/ui/card.tsx`** — elevation + hover-lift (opt-in).
4. **New primitives** (✨): `badge.tsx`, `status-chip.tsx`, `dialog.tsx`, `timeline.tsx`,
   `veg-indicator.tsx`, `skeleton.tsx`, `empty-state.tsx`, `avatar.tsx`, `image-frame.tsx`.
5. **Re-point duplicates** to the shared primitives **without changing their public API or output strings**:
   `app/(admin)/_components/badge.tsx` and `app/(restaurant)/_components/status-badge.tsx` → wrap `ui/badge`/`ui/status-chip`;
   `item-form-dialog.tsx` → build on `ui/dialog`. *(This step touches files E2E may query — preserve labels.)*
6. **Verify:** `pnpm build` + `pnpm lint` + full suite green (reseed first). New primitives have no
   screen wired yet, so the app looks ~identical — the visible payoff starts at the screen passes (§4–§8).
