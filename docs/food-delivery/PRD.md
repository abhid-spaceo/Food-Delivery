# Food Delivery Platform — Product Discovery & PRD

> **Document type:** Startup-style product discovery → Professional PRD → Implementation plan
> **Project nature:** Portfolio / demo SaaS, built by a solo developer
> **Status:** Draft v1 · 2026-06-12
> **Stack (fixed):** Next.js (App Router) · TypeScript · PostgreSQL · Prisma · Tailwind · shadcn/ui · Auth.js (NextAuth) · Vercel
> **Explicitly out of scope (complexity guardrails):** microservices, Kafka, Redis, event buses, Kubernetes, distributed systems

### Locked product decisions (made during discovery)

| Decision | Choice | Why |
|---|---|---|
| **Delivery model** | **Restaurant-fulfilled** — the restaurant itself moves the order to delivered. No courier app, no GPS, no dispatch engine. | Removes the three heaviest subsystems of food delivery. Keeps the product solo-buildable while still feeling real. Roles stay at **Customer / Restaurant / Admin**. |
| **Payments** | **Stripe test-mode** (Stripe Checkout + test cards) | Production-grade feel, excellent docs, no real money. One well-contained external dependency. |
| **Real-time** | **Status polling** (client re-fetch via SWR) | Honors the no-Redis / no-event-bus guardrail. Good enough for a demo; websockets are Future Scope. |

---

# Phase 1 — Product Research

## 1.1 How modern food delivery platforms actually work

A food delivery platform is a **three-sided marketplace** wrapped around a **state machine**. The three sides are *people who want food* (customers), *people who make food* (restaurants), and *the operator* who keeps the marketplace healthy (admin/platform). In full-scale products there is a fourth side — *couriers* — but as decided above, we fold delivery into the restaurant role.

Everything the platform does ultimately serves one core transaction: **a customer turns a craving into a paid order, and a restaurant turns that order into delivered food.** Each feature either (a) helps that transaction happen (discovery, cart, checkout), (b) keeps both parties informed while it happens (order tracking, dashboards), or (c) keeps the marketplace trustworthy and supplied (onboarding, admin oversight, payments).

## 1.2 Patterns shared by Uber Eats, DoorDash, Zomato, Swiggy, Deliveroo

Despite different branding, these products converge on the same building blocks:

| Pattern | What it means | Seen in |
|---|---|---|
| **Discovery-first home** | Land on a feed of nearby/available restaurants with search + cuisine filters, not a login wall. | All five |
| **Restaurant → Menu → Item hierarchy** | A restaurant owns categories; categories own items; items may own modifiers (size, add-ons). | All five |
| **Single-restaurant cart** | One order = one restaurant. Switching restaurants warns/clears the cart. | Uber Eats, DoorDash, Deliveroo |
| **Explicit order state machine** | Orders march through named states; both sides see the current state. | All five |
| **Two-step acceptance** | Restaurant must *accept* before preparing; can *reject* (out of stock, closed). | DoorDash, Swiggy, Zomato |
| **Price snapshotting** | The price the customer paid is frozen on the order, independent of later menu edits. | All five (financial correctness) |
| **Admin gatekeeping** | New restaurants are reviewed/approved before going live. | Zomato, Swiggy, Deliveroo |
| **Status notifications** | Push/poll updates as the order advances. | All five |
| **Ratings & reviews** | Post-delivery feedback feeds discovery ranking. | All five (we defer this) |

The lesson for an MVP: **you do not need the courier/logistics layer to credibly demonstrate the product.** The marketplace + order lifecycle + payments is the recognizable core.

## 1.3 Core building blocks identified

- **User roles:** Customer, Restaurant (owner/staff), Admin.
- **Essential workflows:** browse → add to cart → checkout/pay → restaurant accepts → prepares → out for delivery → delivered; plus restaurant onboarding and menu management.
- **Critical business entities:** User, Restaurant, MenuCategory, MenuItem, Address, Order, OrderItem, Payment, OrderStatusEvent.
- **Standard order lifecycle:** `PLACED → ACCEPTED → PREPARING → OUT_FOR_DELIVERY → DELIVERED`, with branch states `REJECTED` (restaurant declines) and `CANCELLED` (customer/admin cancels before acceptance).
- **Menu management pattern:** categories group items; each item has price, description, image, and an availability toggle (sold-out without deletion).
- **Restaurant onboarding pattern:** restaurant signs up → fills profile (name, cuisine, hours, delivery area) → submits → admin approves → becomes visible to customers.
- **Admin responsibilities:** approve/suspend restaurants, manage users, oversee all orders, view platform metrics.

## 1.4 Feature classification (with the *why*)

### Must-Have (MVP) — without these it isn't a food delivery platform
| Feature | Why it's must-have |
|---|---|
| Auth & roles | Every action is role-scoped; nothing works without identity. |
| Restaurant onboarding + approval | Supply side of the marketplace; admin gatekeeping is core trust. |
| Menu management | A restaurant with no menu can't sell. |
| Restaurant discovery + detail | The customer's entry point to the transaction. |
| Cart (single-restaurant) | The mechanism that assembles an order. |
| Checkout + Stripe (test) payment | No payment = no real transaction to demo. |
| Order lifecycle state machine | The literal heartbeat of the product. |
| Order tracking + history (customer) | Closing the loop; trust and transparency. |
| Restaurant dashboard | Demand has to be fulfilled by someone. |
| Admin dashboard | Keeps the marketplace operable and demonstrates the operator view. |

### Nice-to-Have — real, but the product stands without them in a demo
| Feature | Why deferred |
|---|---|
| Ratings & reviews | Adds trust + ranking, but the core loop works without it. |
| Promo / discount codes | Great for growth, irrelevant to proving the core flow. |
| Favorites / re-order | Convenience, not capability. |
| Multi-address book | One address per checkout is enough to demo. |
| Search ranking / recommendations | Simple filtering suffices at demo scale. |
| Scheduled orders | Niche; adds time-logic complexity. |

### Future — explicitly out, would change the architecture
| Feature | Why future |
|---|---|
| Courier fleet + live GPS | Reintroduces the heaviest subsystems we deliberately removed. |
| Real-time push (websockets/SSE) | Conflicts with the no-Redis/no-event-bus guardrail. |
| Restaurant payouts / settlement | Real financial reconciliation; out of demo scope. |
| Analytics / BI suite | Beyond a demo's needs. |

## 1.5 MVP recommendation

**Build the 10 must-haves above and nothing more.** They form one complete, recognizable loop — a customer can discover a restaurant, order and pay, and watch it through to delivery, while restaurants fulfill and admins govern. Everything else is additive and can be layered in later without re-architecting. This is the smallest scope that still *feels* like a real SaaS product, which is exactly the portfolio goal.

---

# Phase 2 — Product Definition

## 2.1 Product Vision
> **A clean, trustworthy food-ordering marketplace where customers order in a few taps, restaurants manage their orders and menus effortlessly, and a single operator keeps the whole platform healthy — production-quality, without operational over-engineering.**

*Reasoning:* the vision deliberately omits logistics/couriers. It centers on the parts that are both high-value and solo-achievable, and the phrase "without operational over-engineering" encodes the user's explicit complexity guardrails.

## 2.2 Product Goals
1. **Demonstrate an end-to-end marketplace transaction** (browse → pay → fulfill → deliver). *Why:* this is the single most important thing a reviewer/recruiter looks for.
2. **Showcase clean role-based architecture** in a single Next.js app. *Why:* proves real authZ design, not toy CRUD.
3. **Stay solo-maintainable** — no infra a single developer can't run on Vercel + one Postgres. *Why:* the stated constraint.
4. **Look production-grade** in UI and payments. *Why:* portfolio credibility comes from polish + Stripe.

## 2.3 Target Users
- **Customers:** people ordering food for delivery.
- **Restaurant owners/staff:** small/medium restaurants managing their own menu and orders.
- **Platform admin:** the operator (in a demo, the developer) curating supply and overseeing operations.

## 2.4 Primary Use Cases
1. Customer discovers a restaurant, orders, pays, and tracks to delivery.
2. Restaurant onboards, builds a menu, and fulfills incoming orders.
3. Admin approves a new restaurant and monitors platform orders.

## 2.5 User Personas
- **Maya — the Hungry Customer (28, urban professional).** Wants to order dinner fast, see honest status, pay securely. Frustrated by clunky carts and unclear delivery status. Success = food ordered in under 2 minutes with clear tracking.
- **Sam — the Restaurant Owner (40, runs a 1-location eatery).** Wants incoming orders in one screen, easy menu edits, and the ability to mark items sold out. Frustrated by complex POS-style tools. Success = accept and progress an order in a couple of clicks.
- **Riya — the Platform Admin (the operator).** Wants to approve good restaurants, suspend bad ones, and see what's happening across the platform. Success = full visibility and control from one dashboard.

## 2.6 Key Business Flows
1. **Onboarding flow:** restaurant signs up → submits profile → admin approves → live.
2. **Ordering flow:** discover → restaurant page → add to cart → checkout → Stripe pay → order placed.
3. **Fulfillment flow:** restaurant accepts → preparing → out for delivery → delivered (customer sees each step via polling).
4. **Governance flow:** admin reviews restaurants, manages users, oversees orders.

## 2.7 Success Metrics (demo-appropriate)
- **Functional completeness:** 100% of the must-have loop works end-to-end.
- **Order completion:** a placed+paid order can reach `DELIVERED` without manual DB edits.
- **Role isolation:** no role can access another's screens/data (verified by attempting cross-role access).
- **Payment success:** Stripe test checkout confirms and flips `Payment` to `PAID` via webhook.
- **Performance:** discovery and dashboards load fast at demo data volumes (≤ a few hundred rows).

---

# Phase 3 — Feature Discovery (module map)

| Module | Purpose | Business value | User value | Depends on | Complexity | MVP priority |
|---|---|---|---|---|---|---|
| **Authentication & Roles** | Identity + role-based access | Trust, security, the basis of everything | Personalized, safe access | — | Medium | **Must** |
| **Restaurant Onboarding** | Supply acquisition + approval | Grows + curates supply | Restaurants can join | Auth | Medium | **Must** |
| **Menu Management** | CRUD categories/items + availability | Sellable inventory | Customers see what to buy | Auth, Restaurant | Medium | **Must** |
| **Restaurant Discovery** | Browse/search/filter + detail page | Demand entry point | Find food fast | Menu data | Medium | **Must** |
| **Cart** | Assemble a single-restaurant order | Conversion | Build the order | Menu | Low–Med | **Must** |
| **Checkout & Payment** | Address + Stripe pay + place order | Revenue event | Pay securely | Cart, Auth, Stripe | High | **Must** |
| **Order Lifecycle** | State machine + status events | Operational core | Order actually progresses | Checkout | High | **Must** |
| **Order Tracking & History** | Status polling + past orders | Trust/retention | Know what's happening | Order lifecycle | Low–Med | **Must** |
| **Restaurant Dashboard** | Incoming queue + status control + menu | Fulfillment | Run the business | Orders, Menu | Med–High | **Must** |
| **Admin Dashboard** | Manage restaurants/users/orders + metrics | Governance | Operate the platform | All above | Medium | **Must** |
| Ratings & Reviews | Feedback + ranking | Trust/quality | Pick good food | Orders | Medium | Nice |
| Promo Codes | Discounts/growth | Acquisition | Save money | Checkout | Medium | Nice |
| Favorites / Re-order | Convenience | Retention | Faster repeat orders | Orders | Low | Nice |
| Courier Fleet + GPS | Logistics | Scale delivery | Live tracking | New role + infra | Very High | Future |
| Real-time Push | Instant updates | UX polish | No refresh | Infra | High | Future |

*Modules were derived by walking each business flow in 2.6 and asking "what capability must exist for this step to happen?" — not assumed from a template.*

---

# Phase 4 — Information Architecture

## 4.1 Application structure
A **single Next.js App Router application** with three role-scoped **route groups** plus an API layer. One app (not three) is correct for a solo dev: shared components, one deploy, one database, one auth config — while middleware still enforces hard role boundaries.

```
/                      → marketing/landing + redirect to discovery
/(customer)            → browse, restaurant detail, cart, checkout, orders
/(restaurant)          → restaurant dashboard (orders queue, menu mgmt, profile)
/(admin)               → admin dashboard (restaurants, users, orders, metrics)
/api/...               → route handlers (Stripe webhook, mutations as needed)
```

## 4.2 Navigation hierarchy
- **Customer:** Home/Discovery → Restaurant Detail → Cart → Checkout → Order Tracking → Order History. Persistent top nav: logo, search, cart, account.
- **Restaurant:** Dashboard sidebar — Orders (default), Menu, Profile/Hours.
- **Admin:** Dashboard sidebar — Overview/Metrics, Restaurants (approvals), Users, Orders.

## 4.3 User journeys (happy paths)
1. **Customer:** Land → search "pizza" → open restaurant → add 2 items → cart → checkout → Stripe test pay → see "Placed" → watch status advance → "Delivered".
2. **Restaurant:** Login → Orders tab shows new "Placed" order → Accept → Preparing → Out for Delivery → Delivered.
3. **Admin:** Login → Restaurants → see "Pending" applicant → review profile → Approve → restaurant now visible to customers.

## 4.4 Screen inventory
**Customer (6):** Discovery/Home · Restaurant Detail · Cart · Checkout · Order Tracking · Order History.
**Restaurant (4):** Orders Queue · Order Detail · Menu Manager · Profile/Hours.
**Admin (4):** Overview/Metrics · Restaurants (list + approve/suspend) · Users · Orders (all).
**Shared/auth (3):** Sign in · Sign up (role-aware) · Account/Settings.

## 4.5 Dashboard layouts
- **Restaurant dashboard:** left sidebar nav + main content; Orders is a status-grouped list (New / In Progress / Completed) with one-click status advance.
- **Admin dashboard:** left sidebar + main content; Overview shows metric cards (restaurants, orders today, revenue test-total), then data tables with row actions.

## 4.6 Menu structure
`Restaurant → Category (e.g., "Starters") → Item (name, price, description, image, available?)`. Optional, kept minimal for MVP: a single-level modifier (e.g., size) only if time allows — otherwise deferred.

*Why this structure:* it mirrors how every studied platform models menus and how restaurants think about their own menus, so it's intuitive for Sam and maps cleanly to the data model.

---

# Phase 5 — Data Modeling Discovery

We derive entities by walking the business processes, not by guessing tables.

## 5.1 Entity-by-entity reasoning
- **User** — every actor needs identity + a `role`. *Exists because* all access is role-scoped.
- **Restaurant** — the supply unit; owned by a User; has a `status` (PENDING/APPROVED/SUSPENDED). *Exists because* onboarding + approval + visibility depend on it.
- **MenuCategory** — groups items for a restaurant. *Exists because* menus are organized, and discovery/detail render by category.
- **MenuItem** — the sellable unit; price, description, image, `isAvailable`. *Exists because* you can't order what isn't modeled; availability toggle avoids deleting sold-out items.
- **Address** — where to deliver. *Exists because* checkout needs a destination; snapshotted onto the order.
- **Order** — the transaction; links customer + restaurant, holds `status`, totals, `paymentStatus`, delivery address snapshot. *Exists because* it's the central record everything revolves around.
- **OrderItem** — line items with **price/name snapshot at purchase time**. *Exists because* later menu edits must not retroactively change what a customer paid (financial correctness).
- **Payment** — Stripe session/intent id + `status`. *Exists because* payment state is distinct from order state and is confirmed asynchronously by a webhook.
- **OrderStatusEvent** — append-only log of status transitions (from, to, at, byUserId). *Exists because* it powers the customer's tracking timeline and gives an audit trail — and supports the polling model cleanly.

## 5.2 Relationships (ERD in words)
- `User (1) ── (0..1) Restaurant` — a restaurant owner owns one restaurant. *(Customers/admins own none.)*
- `Restaurant (1) ── (N) MenuCategory (1) ── (N) MenuItem`
- `User[customer] (1) ── (N) Address`
- `User[customer] (1) ── (N) Order (N) ── (1) Restaurant`
- `Order (1) ── (N) OrderItem`
- `Order (1) ── (1) Payment`
- `Order (1) ── (N) OrderStatusEvent`

## 5.3 Ownership rules
- A restaurant's menu (categories/items) and its orders are editable **only** by its owner or an admin.
- An order's status may be advanced **only** by the owning restaurant or an admin.
- A customer may read/cancel **only their own** orders (cancel only before `ACCEPTED`).
- Customers see **only APPROVED** restaurants.

## 5.4 Lifecycle states
- **Restaurant:** `PENDING → APPROVED → SUSPENDED` (and back to APPROVED).
- **Order:** `PLACED → ACCEPTED → PREPARING → OUT_FOR_DELIVERY → DELIVERED`; branches `PLACED → REJECTED` (restaurant) and `PLACED → CANCELLED` (customer/admin, pre-acceptance).
- **Payment:** `PENDING → PAID` (or `FAILED`). Order is only shown to the restaurant queue once `Payment = PAID`.

## 5.5 Schema recommendation (Prisma sketch)
```prisma
enum Role { CUSTOMER RESTAURANT ADMIN }
enum RestaurantStatus { PENDING APPROVED SUSPENDED }
enum OrderStatus { PLACED ACCEPTED PREPARING OUT_FOR_DELIVERY DELIVERED REJECTED CANCELLED }
enum PaymentStatus { PENDING PAID FAILED }

model User {
  id          String   @id @default(cuid())
  email       String   @unique
  name        String?
  role        Role     @default(CUSTOMER)
  restaurant  Restaurant?
  addresses   Address[]
  orders      Order[]   @relation("CustomerOrders")
  createdAt   DateTime @default(now())
}

model Restaurant {
  id         String           @id @default(cuid())
  ownerId    String           @unique
  owner      User             @relation(fields: [ownerId], references: [id])
  name       String
  cuisine    String
  status     RestaurantStatus @default(PENDING)
  hours      String?
  deliveryArea String?
  categories MenuCategory[]
  orders     Order[]
  createdAt  DateTime         @default(now())
}

model MenuCategory {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  name         String
  sortOrder    Int        @default(0)
  items        MenuItem[]
}

model MenuItem {
  id          String       @id @default(cuid())
  categoryId  String
  category    MenuCategory @relation(fields: [categoryId], references: [id])
  name        String
  description String?
  priceCents  Int
  imageUrl    String?
  isAvailable Boolean      @default(true)
}

model Address {
  id        String  @id @default(cuid())
  userId    String
  user      User    @relation(fields: [userId], references: [id])
  line1     String
  city      String
  postcode  String
}

model Order {
  id            String        @id @default(cuid())
  customerId    String
  customer      User          @relation("CustomerOrders", fields: [customerId], references: [id])
  restaurantId  String
  restaurant    Restaurant    @relation(fields: [restaurantId], references: [id])
  status        OrderStatus   @default(PLACED)
  subtotalCents Int
  deliveryFeeCents Int        @default(0)
  totalCents    Int
  addressLine   String        // snapshot
  items         OrderItem[]
  payment       Payment?
  events        OrderStatusEvent[]
  createdAt     DateTime      @default(now())
}

model OrderItem {
  id        String @id @default(cuid())
  orderId   String
  order     Order  @relation(fields: [orderId], references: [id])
  name      String // snapshot
  priceCents Int   // snapshot
  quantity  Int
}

model Payment {
  id              String        @id @default(cuid())
  orderId         String        @unique
  order           Order         @relation(fields: [orderId], references: [id])
  stripeSessionId String?
  status          PaymentStatus @default(PENDING)
}

model OrderStatusEvent {
  id        String      @id @default(cuid())
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id])
  from      OrderStatus?
  to        OrderStatus
  byUserId  String?
  createdAt DateTime    @default(now())
}
```

*Note:* money is stored as integer cents (`priceCents`) — the standard way to avoid floating-point money bugs.

---

# Phase 6 — Technical Architecture

## 6.1 Folder structure
```
app/
  (marketing)/page.tsx
  (customer)/...        // discovery, restaurant/[id], cart, checkout, orders
  (restaurant)/...      // dashboard, menu, profile
  (admin)/...           // restaurants, users, orders, overview
  api/
    stripe/webhook/route.ts
    ...                 // route handlers where Server Actions don't fit
components/
  ui/                   // shadcn/ui primitives
  ...                   // feature components
lib/
  auth.ts               // NextAuth config
  db.ts                 // Prisma client singleton
  stripe.ts             // Stripe client
  orders/state.ts       // order state-machine transitions (single source of truth)
prisma/
  schema.prisma
  migrations/
middleware.ts           // role-based route protection
```

## 6.2 Frontend architecture
- **Server Components by default** for data reads (fast, no client fetching boilerplate).
- **shadcn/ui + Tailwind** for a consistent, production-looking UI.
- **Minimal client state:** cart lives in React context + `localStorage`, reconciled at checkout. *Why:* avoids a global state library for what is genuinely local, transient state.
- **SWR** only where polling matters (order tracking page, restaurant order queue).

## 6.3 Backend architecture
- **Server Actions** for mutations (add to cart-checkout, accept order, advance status, menu CRUD). *Why:* co-locates logic with the app, fewer API endpoints to maintain solo.
- **Route Handlers** for the few things that must be HTTP endpoints — notably the **Stripe webhook**.
- **Order state machine** centralized in `lib/orders/state.ts` so transitions are validated in one place (no illegal jumps like `PLACED → DELIVERED`).

## 6.4 API strategy
Prefer Server Actions; expose Route Handlers only for (a) Stripe webhook and (b) any client-polled JSON the SWR hooks need. Keep a consistent response envelope (`{ ok, data, error }`) for the JSON endpoints.

## 6.5 Authentication strategy
**Auth.js / NextAuth** with database sessions or JWT carrying `role`. Email/password (or a dev OAuth provider) is sufficient for a demo. Role is set at sign-up (customer vs restaurant); admin is seeded.

## 6.6 Authorization strategy
- **`middleware.ts`** guards route groups: `/(restaurant)` requires `RESTAURANT`, `/(admin)` requires `ADMIN`.
- **Per-action checks** in Server Actions re-verify ownership (a restaurant can only mutate its own data) — never trust the route guard alone.

## 6.7 State management
Server Components for server state; React context + localStorage for the cart; SWR for polled views. No Redux/Zustand — unjustified at this scale.

## 6.8 Deployment architecture
**Vercel** for the app + **Vercel Postgres / Neon** for the database. Prisma migrations run in CI/deploy. Stripe in test mode with a webhook pointed at the deployed `/api/stripe/webhook`. Single environment to start; add a preview/prod split if desired.

---

# Phase 7 — Product Requirements Document (PRD)

## 7.1 Executive Summary
A solo-buildable, three-sided food delivery marketplace. Customers discover restaurants, order and pay (Stripe test mode), and track orders to delivery; restaurants fulfill orders and manage menus; an admin governs the platform. Delivery is restaurant-fulfilled (no courier logistics), and updates use polling — deliberate choices that keep the system production-looking yet free of heavy infrastructure.

## 7.2 Product Vision
*See 2.1.* A clean, trustworthy marketplace that nails the core order loop without operational over-engineering.

## 7.3 Goals
*See 2.2.* End-to-end transaction · clean role architecture · solo-maintainable · production-grade polish.

## 7.4 User Personas
*See 2.5.* Maya (customer), Sam (restaurant owner), Riya (admin).

## 7.5 Functional Requirements
**Auth & Roles**
- FR-1 Users can sign up as customer or restaurant; admin is seeded.
- FR-2 Sessions carry a role; route groups are role-guarded.

**Restaurant Onboarding & Menu**
- FR-3 A restaurant user can create/edit its profile (name, cuisine, hours, delivery area).
- FR-4 A new restaurant is `PENDING` and invisible to customers until an admin `APPROVES` it.
- FR-5 A restaurant can CRUD categories and items, set price/description/image, and toggle availability.

**Discovery & Cart**
- FR-6 Customers see only `APPROVED` restaurants; can search by name and filter by cuisine.
- FR-7 A restaurant detail page lists available items by category.
- FR-8 Customers add items to a **single-restaurant** cart; adding from another restaurant warns/clears.

**Checkout & Payment**
- FR-9 Checkout collects a delivery address and shows an order summary with totals.
- FR-10 Payment uses Stripe test-mode Checkout; on success the webhook flips `Payment` to `PAID`.
- FR-11 An order is created at `PLACED` and only appears in the restaurant queue once `PAID`.

**Order Lifecycle & Tracking**
- FR-12 Restaurant can `ACCEPT` or `REJECT` a `PLACED` order; then advance `PREPARING → OUT_FOR_DELIVERY → DELIVERED`.
- FR-13 Illegal transitions are rejected by the central state machine.
- FR-14 Every transition writes an `OrderStatusEvent`.
- FR-15 Customers see live status (polled) and a tracking timeline; can cancel only before `ACCEPTED`.
- FR-16 Customers have an order history list + detail.

**Admin**
- FR-17 Admin can approve/suspend restaurants, view/manage users, and view all orders.
- FR-18 Admin overview shows basic metrics (restaurants, orders today, test revenue total).

## 7.6 User Flows
*See 2.6 and 4.3.* Onboarding, ordering, fulfillment, governance — each walked step by step.

## 7.7 Information Architecture
*See Phase 4.* One app, three route groups, 17 screens inventoried.

## 7.8 Business Rules
- Single-restaurant cart.
- Order item prices are snapshotted at purchase; later menu edits don't change past orders.
- Orders enter the restaurant queue only after payment is `PAID`.
- Only the owning restaurant or admin may advance an order; only legal transitions allowed.
- Customers can cancel only before `ACCEPTED`.
- Only `APPROVED` restaurants are customer-visible.

## 7.9 Data Model
*See Phase 5* for entities, relationships, lifecycle states, and the Prisma schema.

## 7.10 Technical Recommendations
*See Phase 6.* Next.js App Router (single app, route groups), Server Actions + minimal Route Handlers, Prisma/Postgres, NextAuth roles, Stripe test webhook, SWR polling, Vercel deploy.

## 7.11 MVP Scope
The 10 must-have modules (Phase 1.4 / Phase 3). Nothing else.

## 7.12 Future Scope
Ratings/reviews, promo codes, favorites/re-order, multi-address, courier fleet + GPS, real-time push, payouts/settlement, analytics.

## 7.13 Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Stripe webhook misconfig in prod | Orders stuck `PENDING` | Test webhook locally with Stripe CLI; add a manual admin "mark paid" fallback for the demo. |
| Polling feels laggy | Weaker UX impression | Short poll interval on active orders only; show optimistic status on action. |
| Scope creep into couriers/real-time | Blows the solo budget | Treat as Future Scope; guard the line in reviews. |
| Role authZ gaps | Cross-tenant data access | Re-check ownership in every Server Action, not just middleware. |
| Money rounding bugs | Wrong totals | Store integer cents everywhere. |

## 7.14 Assumptions
- Single currency, single region for the demo.
- Admin account is seeded, not self-registered.
- Demo data volumes are small (hundreds of rows).
- Email/password (or one dev OAuth provider) is acceptable auth.
- Restaurant staff = the single owner account (no multi-staff roles in MVP).

## 7.15 Development Roadmap
*See Phase 8.* Six milestones, dependency-ordered.

## 7.16 Acceptance Criteria (MVP "done")
- AC-1 A customer can complete discover → pay (Stripe test) → track → see `DELIVERED` with no manual DB edits.
- AC-2 A restaurant can onboard, get approved, build a menu, and progress an order through all states.
- AC-3 An admin can approve a restaurant and see it become customer-visible.
- AC-4 No role can open another role's screens or mutate another's data.
- AC-5 Illegal order transitions are blocked.
- AC-6 Paid orders appear in the restaurant queue; unpaid ones do not.

---

# Phase 8 — Implementation Planning

## 8.1 Development Milestones (dependency-ordered)
1. **M1 — Foundation:** Next.js + TS + Tailwind + shadcn/ui, Prisma schema + migration, NextAuth with roles, middleware guards, seeded admin.
2. **M2 — Supply side:** restaurant onboarding/profile, admin approval, menu CRUD + availability.
3. **M3 — Demand side:** discovery (search/filter), restaurant detail, single-restaurant cart.
4. **M4 — Money:** checkout, Stripe test Checkout, webhook → `Payment = PAID`, order creation at `PLACED`.
5. **M5 — Fulfillment:** order state machine, restaurant order queue + transitions, status events, customer tracking (polling) + history.
6. **M6 — Governance & polish:** admin dashboard (restaurants/users/orders/metrics), QA pass, empty/error states, deploy.

## 8.2 Sprint Breakdown (assume ~1-week sprints, solo)
- **Sprint 1:** M1 + start M2 (auth, schema, restaurant profile, approval).
- **Sprint 2:** finish M2 + M3 (menu CRUD, discovery, cart).
- **Sprint 3:** M4 + start M5 (checkout/Stripe, state machine, restaurant queue).
- **Sprint 4:** finish M5 + M6 (tracking/history, admin dashboard, QA, deploy).

## 8.3 JIRA Epics
- **EPIC-1 Auth & Roles**
- **EPIC-2 Restaurant Onboarding & Approval**
- **EPIC-3 Menu Management**
- **EPIC-4 Discovery & Cart**
- **EPIC-5 Checkout & Payments**
- **EPIC-6 Order Lifecycle & Tracking**
- **EPIC-7 Admin Dashboard**

## 8.4 JIRA Stories (representative, with acceptance criteria)
**EPIC-1**
- FD-1 *As a user, I can sign up choosing customer or restaurant.* AC: role persisted; redirected to the right home.
- FD-2 *As any user, I'm blocked from other roles' areas.* AC: middleware redirects; Server Actions re-check ownership.

**EPIC-2**
- FD-10 *As a restaurant, I can submit my profile.* AC: created as `PENDING`, not customer-visible.
- FD-11 *As an admin, I can approve/suspend a restaurant.* AC: status flips; visibility updates.

**EPIC-3**
- FD-20 *As a restaurant, I can add categories and items with price/image.* AC: appears on my detail page.
- FD-21 *As a restaurant, I can toggle item availability.* AC: unavailable items hidden from customers, not deleted.

**EPIC-4**
- FD-30 *As a customer, I can search and filter approved restaurants.* AC: only `APPROVED` shown.
- FD-31 *As a customer, I can add items to a single-restaurant cart.* AC: switching restaurants warns/clears.

**EPIC-5**
- FD-40 *As a customer, I can pay via Stripe test checkout.* AC: success → webhook → `Payment=PAID`, order `PLACED`.
- FD-41 *As a system, unpaid orders don't reach the restaurant queue.* AC: queue filters on `PAID`.

**EPIC-6**
- FD-50 *As a restaurant, I can accept/reject and advance an order.* AC: only legal transitions; event logged.
- FD-51 *As a customer, I can track status and cancel before acceptance.* AC: polled timeline; cancel disabled after `ACCEPTED`.
- FD-52 *As a customer, I can view order history.* AC: list + detail for my orders only.

**EPIC-7**
- FD-60 *As an admin, I can view all orders and platform metrics.* AC: overview cards + tables render.

## 8.5 Recommended Build Order (critical path)
`Auth/roles → DB schema → restaurant profile + admin approval → menu CRUD → discovery + cart → checkout + Stripe webhook → order state machine → restaurant queue → customer tracking/history → admin dashboard → QA/polish/deploy.`

*Rationale:* nothing is built before the data and identity it depends on. Payments precede the lifecycle because the queue gates on `PAID`. Admin dashboard comes last because it observes everything else.

---

## Testing & QA notes (for the build phase)
- **E2E (Playwright):** the three happy-path journeys (customer order, restaurant fulfillment, admin approval) + role-isolation negative tests. *Does NOT cover:* Stripe's own UI, real payment networks, or load.
- **Deterministic data:** seed script for admin + sample restaurants/menus; no fixed sleeps — wait on status text/elements.
- **Unit:** the order state machine (legal/illegal transitions) and money math.
- **Not covered by this document:** real courier logistics, real-time push, multi-region, and production payment compliance — all Future Scope.
