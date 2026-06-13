# UI Upgrade — All Screens (push beyond the mockups)

> **Status: change-list / proposal only. NO code in this pass.** This is the document the
> user asked for: *what* we will change on every screen to take the UI from "basic" to
> production-grade. Implementation happens later, screen-by-screen, with a browser check each time.

**Date:** 2026-06-14
**Ambition:** treat `docs/food-delivery/design/*.html` mockups as the **floor**, not the ceiling —
match their structure, then add depth, motion, imagery, and refinement beyond them.
**Scope:** all screens, all four roles + marketing/auth.
**Hard constraint (unchanged):** visual only. Do **not** change behavior, routes, data, or any
text/accessible name E2E tests query (`"Sign in"`, `"Create account"`, `"Accept"`, `"Start preparing"`,
`"Mark ready"`, status labels `"Placed"`/`"Ready"`/etc., `"Open"`, `"No further actions for this order."`).
Full suite (`pnpm test && pnpm test:e2e`) stays green after every screen.

---

## 0. Why "tokens first" wasn't enough (the reframe)
Defining CSS variables changes nothing visible — a screen looks identical until a *component* uses
them. "Basic" means the **screens themselves** are unstyled: plain headings, bare forms, raw tables,
no depth/imagery/hierarchy. So this plan rebuilds **screens + shared components**, not just tokens.
Tokens and primitives are listed first only because they're the reusable parts every screen pulls from.

---

## 1. The elevated design language (the new bar)

What "beyond the mockups" means concretely — applied consistently everywhere:

| Dimension | Mockup baseline | Our elevated bar |
|---|---|---|
| **Depth** | flat cards, 1 shadow | 3-tier elevation: `rest / hover / overlay`; cards lift on hover |
| **Brand surfaces** | solid coral | coral **gradient** for hero/CTA/earnings; soft-coral tint blocks |
| **Motion** | none | 150–200ms ease on hover/focus; list fade-in; skeleton shimmer; modal scale-in |
| **Imagery** | emoji placeholders | gradient-mesh photo frames + emoji fallback; rounded 16px with overlay |
| **Typography** | 14px base, weights | true type scale (display/h1/h2/h3/body/caption) + tighter heading tracking |
| **Iconography** | sparse | `lucide-react` icons in nav, buttons, stats, empty states |
| **States** | mostly missing | every data screen: skeleton → content, branded empty, retryable error |
| **Data density** | plain tables | zebra/hover rows, sticky headers, aligned numerics (`tabular-nums`), status chips |
| **Glass/blur** | sticky bars | translucent `backdrop-blur` headers + subtle border |

### 1A. Foundation tokens to add (`app/globals.css`) — additive, breaks nothing
- [ ] Semantic colors + soft tints: `success #12B886 / #E6F8F1`, `warning #E8890C / #FDF1DF`, `info #3B82F6 / #EAF2FE`.
- [ ] Named brand tokens: `brand-dark #E82E4D`, `brand-soft #FFEDF0`, **`--gradient-brand: linear-gradient(135deg,#FF6B81,#FF2E54)`**.
- [ ] Elevation scale: `--shadow-sm`, `--shadow-card`, `--shadow-overlay` (3 tiers).
- [ ] Motion tokens: `--ease`, `--dur-fast 150ms`, `--dur 200ms`.
- [ ] Expose all via `@theme inline` so utilities (`bg-success`, `shadow-card`, etc.) exist.

### 1B. Shared component upgrades (`components/ui/*`) — unblocks every screen
- [ ] **Button** — pill shape (`rounded-full`); add `gradient` variant; loading spinner state; keep `icon` square-ish (rounded-xl, not circle).
- [ ] **Card** — elevation + `hover:shadow-card hover:-translate-y-0.5 transition`.
- [ ] **Badge** (promote to `components/ui/`) — `brand/success/warning/info/gray` variants from 1A tokens.
- [ ] **Dialog/Modal** — accessible (focus trap, Esc, scale-in overlay); replaces hand-rolled menu overlay.
- [ ] **Timeline** — vertical dot-and-line tracker (done/current/pending) for order + delivery tracking.
- [ ] **VegIndicator** — green-dot / red-triangle marker.
- [ ] **Skeleton** + **EmptyState** + **ErrorState** — the three reusable data states.
- [ ] **StatusChip** — order/payment/approval status pill mapped to semantic tokens.
- [ ] **Avatar** + **Logo lockup** — gradient mark + wordmark, reused in headers/profiles.

---

## 2. Per-screen change-list

Legend: 🔴 placeholder/bare · 🟡 functional-but-plain · 🟢 already decent (polish only).
"Lives in" = which branch/worktree the screen's code is on.

### 2.1 Marketing + Auth — lives in `Abhi/qwikbite`
| Screen | Now | Changes |
|---|---|---|
| **Landing** (`(marketing)/page.tsx`) | 🔴 text + 2 buttons | Full hero: gradient headline band, value prop, dual CTA (Browse / For partners), 3 feature tiles w/ icons, footer. Keep link targets + visible text. |
| **Sign in** (`(auth)/signin`) | 🟢 card | Logo lockup above card; gradient submit button; inline error styled; **preserve labels `Email`/`Password` + button `Sign in`**. |
| **Sign up** (`(auth)/signup`) | 🟡 raw radios | Role-selector as **chips/cards** (Customer/Restaurant/Driver) with icons; password hint; **preserve field labels + button `Create account`**. |

### 2.2 Customer — lives in `Abhi/qwikbite-customer` worktree (Phase 2)
| Screen | Changes |
|---|---|
| **Browse / Discovery** | Sticky search + **horizontal cuisine chip rail**; restaurant **card grid** (image frame, ⭐rating chip, delivery time + fee, promo badge, hover lift); skeleton + empty + error states. |
| **Restaurant detail + menu** | Banner image; sticky category sidebar; menu items w/ **VegIndicator**, price, qty stepper; **sticky cart panel** (desktop) / **bottom cart bar** (mobile). |
| **Cart** | Line items w/ qty steppers, single-restaurant warning **Dialog**, bill breakdown card, gradient checkout CTA. |
| **Checkout** | Two-column: address radios + Stripe; order summary card; pay button loading state. |
| **Order placed** | Success ring + checkmark animation; order ref; CTA to track. |
| **Order tracking** | **Timeline** component (live-polled), driver card, dark "arriving in" header, address. |
| **Order history** | Card list w/ thumbnail, status chip, amount, Track/View. |
| **Profile / addresses** | Avatar card; address cards w/ add/edit **Dialog**. |

### 2.3 Restaurant — lives in `Abhi/qwikbite`
| Screen | Now | Changes |
|---|---|---|
| **Dashboard/Queue** (`/restaurant`) | 🟢 Kanban | Column headers w/ count chips; richer OrderCard (PAID chip, time-ago, item count, total `tabular-nums`); preserve SWR polling + action text. |
| **Order detail** (`/restaurant/orders/[id]`) | 🟢 cards | Add status **Timeline**; customer/address block w/ icons; sticky action bar; **preserve action button text**. |
| **Menu manager** (`/restaurant/menu`) | 🟡 | Item rows w/ thumbnail + **VegIndicator**; availability **toggle**; add/edit via **Dialog**; category sections w/ counts. |
| **Profile** (`/restaurant/profile`) | 🟡 bare form | Card form w/ sections; **store-status toggle**; read-only approval **StatusChip**. |

### 2.4 Driver — lives in `Abhi/qwikbite-driver` worktree (Phase 3)
| Screen | Changes |
|---|---|
| **Pickup pool** | Order cards w/ pickup→drop **route mini-viz**, fee, "Ready" chip, Claim button; live-updates note; empty state. |
| **Claim / order detail** | Route visualization (pickup/drop dots+line), "you'll earn" amount, claim button, race-condition warning card. |
| **Active delivery** | Dark header, route card w/ call/maps actions, **Timeline**, gradient "Mark delivered" CTA. |
| **Earnings** | **Gradient** total card, 3 stat tiles, display-only note. |
| **History + profile** | History cards w/ delivered chip + amount; avatar profile w/ approval chip + action cards. |

### 2.5 Admin — lives in `Abhi/qwikbite`
| Screen | Now | Changes |
|---|---|---|
| **Overview** (`/admin`) | 🟡 plain | Richer **StatCards** (icon, big numeric, delta, hover lift); 2-col "Pending approvals" + "Orders by state" cards; recent-orders table polish. |
| **Restaurants** (`/admin/restaurants`) | 🟢 | Status **tabs**; table w/ thumbnail + **StatusChip**; action buttons (Approve/Suspend) w/ confirm **Dialog**. |
| **Orders** (`/admin/orders`) | 🟢 | Status tabs/filter; row hover; inline detail panel polish; `tabular-nums` money. |
| **Users** (`/admin/users`) | 🟡 | **Role tabs** + search; role-colored **Badge**; status chip; suspend confirm **Dialog**. |

---

## 3. Cross-cutting (apply to all screens)
- [ ] **Loading/empty/error** on every data screen (Skeleton / EmptyState / ErrorState).
- [ ] **Responsive**: desktop multi-column → tablet drawers → mobile single-column + hamburger / bottom cart bar.
- [ ] **Motion**: hover lifts, focus rings, list fade-in, modal scale-in, skeleton shimmer (respect `prefers-reduced-motion`).
- [ ] **Accessibility**: keep semantic labels, focus order, aria on Dialog/Timeline; contrast ≥ AA.
- [ ] **Icons**: `lucide-react` already a dep — use in nav, buttons, stats, empty states.

---

## 4. Where the work lives (branch / worktree map)
| Work | Branch |
|---|---|
| Foundation tokens (1A) + shared components (1B) | **`Abhi/qwikbite`** (shared layer — must land here so all inherit) |
| Marketing, Auth, Restaurant, Admin screens | **`Abhi/qwikbite`** |
| Customer screens (2.2) | `Abhi/qwikbite-customer` worktree |
| Driver screens (2.4) | `Abhi/qwikbite-driver` worktree |

> Foundation lands on `Abhi/qwikbite` **first**; customer/driver worktrees inherit it on their next
> rebase from main, then build their role screens on the settled component set. (Same reasoning as
> [`2026-06-14-design-system-gap-analysis.md`](./2026-06-14-design-system-gap-analysis.md) §4 — shared
> code belongs on the shared branch, not a side worktree.)

---

## 5. Risk & verification
- **Highest blast radius:** `globals.css`, `components/ui/button.tsx`, `card.tsx`, the shared
  header/nav/shell — every screen + both worktrees inherit these. Change once, verify broadly.
- **Per screen:** preserve test-queried strings; `pnpm build` + `pnpm lint` clean; full suite green
  (reseed first); **headed** browser compare vs. mockup.
- No new unit tests (styling), but **E2E must not regress** — if a selector breaks, restore the exact text.

---

## 6. Proposed sequence
1. **Foundation** (1A tokens + 1B components) on `Abhi/qwikbite` — invisible alone, but everything below depends on it.
2. **Landing** (biggest visible before/after, standalone) → sets the bar you sign off on.
3. **Auth** → **Admin** → **Restaurant** screens on `Abhi/qwikbite`.
4. **Customer** (in its worktree) → **Driver** (in its worktree).
5. Full-suite regression gate per the per-phase rule.

---

## 7. Open decisions for the user
1. **Approve this as the target?** Anything in §1 to dial up/down (e.g. how much motion)?
2. **Start point:** Foundation first (1A+1B, no visible change yet), or jump straight to **Landing**
   so you see a polished screen immediately (then backfill foundation)?
3. **Imagery:** real food photos (need asset source) vs. gradient-mesh + emoji fallback (no assets, ships now)?
4. **Execution mode:** I implement inline screen-by-screen (stop for review each), or dispatch a
   subagent per screen against this spec?
