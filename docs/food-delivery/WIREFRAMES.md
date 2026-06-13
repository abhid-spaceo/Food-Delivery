# Food Delivery Platform — Low-Fidelity Wireframes & UX Spec

> **Source of truth:** `PRD.md` (same folder)
> **Fidelity:** Low — structure, hierarchy, flow, and component placement only. **No** color, type, or branding.
> **Audience:** A UI designer can start high-fidelity Figma screens directly; a developer can understand the full app structure.
> **Locked product context (from PRD):** Restaurant-fulfilled delivery (Customer / Restaurant / Admin — no courier app), Stripe test-mode payments, status **polling** (no websockets), money as integer cents.

---

# 1. Product Structure (Step 1 — Understand the Product)

**Product goal:** Let a customer turn a craving into a paid order, and a restaurant turn that order into delivered food — with an admin governing the marketplace. Everything serves that one transaction.

| Dimension | Summary |
|---|---|
| **User roles** | **Customer** (orders food), **Restaurant Owner** (sells + fulfills), **Admin** (operates the platform) |
| **Core entities** | User · Restaurant · MenuCategory · MenuItem · Address · Order · OrderItem · Payment · OrderStatusEvent |
| **Order lifecycle** | `PLACED → ACCEPTED → PREPARING → OUT_FOR_DELIVERY → DELIVERED`, branches `REJECTED` / `CANCELLED` |
| **Payment lifecycle** | `PENDING → PAID` (or `FAILED`); order reaches restaurant queue only when `PAID` |
| **Restaurant lifecycle** | `PENDING → APPROVED → SUSPENDED` (only `APPROVED` are customer-visible) |

**Business workflows:** (1) Onboarding — restaurant applies → admin approves → live. (2) Ordering — discover → cart → pay → place. (3) Fulfillment — accept → prepare → out for delivery → delivered. (4) Governance — admin approves/suspends, manages users, oversees orders.

**Navigation structure (top level):** one Next.js app, three role-scoped areas — `(customer)`, `(restaurant)`, `(admin)` — guarded by middleware. Customers use a top nav; restaurant/admin use a left sidebar dashboard shell.

---

# 2. Information Architecture — Sitemap (Step 2)

```
Food Delivery Platform
│
├── PUBLIC
│   ├── Landing  ............... entry; explains product, links to browse/sign-in
│   ├── Sign In  ............... authenticate (role-aware redirect)
│   └── Sign Up  ............... choose Customer or Restaurant
│
├── CUSTOMER  (top-nav shell: Logo | Search | Cart | Account)
│   ├── Discovery (Home)  ...... browse APPROVED restaurants; search + cuisine filter   [PRIMARY]
│   ├── Restaurant Detail  ..... menu by category; add to cart                          [PRIMARY]
│   ├── Cart  .................. review single-restaurant cart                           [PRIMARY]
│   ├── Checkout  ............... address + summary + Stripe pay                         [PRIMARY]
│   ├── Order Tracking  ........ live (polled) status timeline for one order            [PRIMARY]
│   └── Account  (secondary nav)
│       ├── Profile  ........... name/email                                             [SECONDARY]
│       ├── Orders (History)  .. past + active orders → open tracking                   [SECONDARY]
│       └── Addresses  ......... saved delivery addresses                               [SECONDARY]
│
├── RESTAURANT OWNER  (sidebar shell)
│   ├── Orders Queue  .......... default; New / In-Progress / Completed columns         [PRIMARY]
│   ├── Order Detail  .......... one order; advance status                              [PRIMARY]
│   ├── Menu Manager  .......... categories + items CRUD, availability toggle           [PRIMARY]
│   └── Profile / Hours  ....... restaurant profile, cuisine, hours, delivery area      [MGMT]
│
└── ADMIN  (sidebar shell)
    ├── Overview / Metrics  .... platform KPI cards + recent activity                   [REPORTING]
    ├── Restaurants  ........... approve / suspend; review applications                 [OPERATIONAL]
    ├── Users  ................. list/manage customers & restaurant owners              [OPERATIONAL]
    └── Orders  ................ all platform orders, filter by status                  [OPERATIONAL]
```

**Why each page exists**

| Page | Why it exists |
|---|---|
| Landing | A public front door so the app reads as a real product, not a login wall. |
| Sign In / Sign Up | Identity is the basis of all role-scoped access; sign-up forks into Customer vs Restaurant. |
| Discovery | The customer's entry to the core transaction; without it there's nothing to order. |
| Restaurant Detail | Where the menu is browsed and the cart is built. |
| Cart | Assembles and validates a single-restaurant order before payment. |
| Checkout | Captures destination + collects payment — the revenue moment. |
| Order Tracking | Closes the trust loop; customer sees the order progress. |
| Account (Profile/Orders/Addresses) | Self-service: reorder history, manage addresses. |
| Restaurant Orders Queue | The fulfillment workspace — the screen the owner lives in. |
| Menu Manager | A restaurant with no editable menu can't sell. |
| Restaurant Profile/Hours | Supply-side data the admin reviews and customers see. |
| Admin Restaurants | Gatekeeping supply (approve/suspend) — core marketplace trust. |
| Admin Users / Orders | Governance + visibility across the platform. |
| Admin Overview | The operator's at-a-glance health view. |

---

# 3. Screen Inventory (Step 3)

**Legend:** Role = C(ustomer) / R(estaurant) / A(dmin) / P(ublic).

### Core Screens
| # | Screen | Role | Purpose | Entry point | Exit actions | Depends on |
|---|---|---|---|---|---|---|
| S1 | Landing | P | Introduce product | Direct URL | → Sign in / Browse | — |
| S2 | Sign In | P | Authenticate | Landing, guard redirect | → role home | Auth |
| S3 | Sign Up | P | Register (role choice) | Landing/Sign in | → role home / pending | Auth |
| S4 | Discovery (Home) | C | Browse + search restaurants | Login, nav logo | → Restaurant Detail | Approved restaurants |
| S5 | Restaurant Detail | C | View menu, add items | Discovery card | → Cart | Menu data |
| S6 | Cart | C | Review/edit order | Cart icon, Restaurant Detail | → Checkout / back | Cart state |
| S7 | Checkout | C | Address + pay | Cart | → Stripe → Order Tracking | Cart, Address, Stripe |
| S8 | Order Tracking | C | Polled status timeline | Post-checkout, Orders list | → Orders / Discovery | Order, events |
| S9 | Orders (History) | C | Past + active orders | Account nav | → Order Tracking | Orders |
| S10 | Restaurant Orders Queue | R | Triage + fulfill | Login, sidebar | → Order Detail | Paid orders |
| S11 | Order Detail (Restaurant) | R | Act on one order | Queue card | → advance status | Order state machine |
| S12 | Menu Manager | R | CRUD menu | Sidebar | → item modal | Restaurant |
| S13 | Restaurant Profile/Hours | R | Edit profile | Sidebar | → save | Restaurant |
| S14 | Admin Overview | A | Platform metrics | Login, sidebar | → drill into tables | All |
| S15 | Admin Restaurants | A | Approve/suspend | Sidebar | → restaurant review | Restaurants |
| S16 | Admin Users | A | Manage users | Sidebar | → user detail | Users |
| S17 | Admin Orders | A | Oversee all orders | Sidebar | → order detail | Orders |

### Supporting Screens
| Screen | Role | Purpose |
|---|---|---|
| Customer Profile | C | Edit name/email |
| Addresses | C | Manage saved addresses |
| Restaurant Review (admin) | A | Inspect a pending restaurant before approving |
| Order Confirmation | C | Brief "order placed" confirmation before tracking |

### Modal Screens
- **Add/Edit Menu Item** (R) — name, price, description, image URL, availability.
- **Add/Edit Category** (R).
- **Add/Edit Address** (C).
- **Confirm Reject Order** (R) — reason.
- **Cart-conflict warning** (C) — "Adding from another restaurant will clear your cart."
- **Suspend Restaurant confirm** (A).

### Empty States (screens that need one)
Discovery (no restaurants in area) · Cart (empty) · Orders/History (no orders yet) · Restaurant Queue (no incoming orders) · Menu Manager (no items yet) · Admin tables (no rows / no pending approvals).

### Error States
Payment failed (Checkout) · Item/restaurant unavailable (Restaurant Detail) · Network/load failure (any data screen) · Illegal action (e.g., trying to cancel an already-accepted order) · 403 wrong-role redirect.

---

# 4. User Flow Mapping (Step 4)

### Customer

**Sign Up**
```
Landing → "Sign Up" → choose role [Customer]
 → enter email/password/name → submit
 → (valid?) yes → session created (role=CUSTOMER) → Discovery
            no  → inline field errors → stay
```

**Login**
```
Sign In → enter credentials → submit
 → valid?  yes → redirect by role (Customer→Discovery, Restaurant→Queue, Admin→Overview)
            no  → "Invalid credentials" error → stay
```

**Browse Restaurants**
```
Discovery → see grid of APPROVED restaurants
 → apply cuisine filter / sort → list updates (server query)
 → click card → Restaurant Detail
```

**Search Food**
```
Discovery → type in Search ("pizza") → submit/debounced
 → results filtered by name/cuisine → (results? no → empty state)
 → click result → Restaurant Detail
```

**View Restaurant**
```
Restaurant Detail → menu grouped by category
 → unavailable items shown disabled or hidden
 → tap item → quantity → "Add to cart"
 → (cart has another restaurant? → cart-conflict modal → clear & add / cancel)
```

**Add To Cart → Checkout → Place Order**
```
Restaurant Detail → Add items → Cart icon badge increments
 → open Cart → adjust qty / remove → "Proceed to checkout"
 → Checkout: select/add Address → review summary (subtotal, fee, total)
 → "Pay" → Stripe test Checkout (test card)
    → success → webhook sets Payment=PAID, Order=PLACED
              → Order Confirmation → Order Tracking
    → failure → return to Checkout with "Payment failed" error
```

**View Orders**
```
Account → Orders → list (active on top, history below)
 → click active → Order Tracking (polled timeline)
 → click past → read-only Order Detail
```

### Restaurant Owner

**Login**
```
Sign In (role=RESTAURANT) → Orders Queue (default)
 → (restaurant still PENDING? → "Awaiting admin approval" banner, limited access)
```

**Manage Menu / Create Item / Update Item**
```
Menu Manager → categories list with items
 Create category: "+ Category" → modal (name) → save → appears
 Create item:     within category "+ Item" → modal (name, price, desc, image, available) → save
 Update item:     click item → modal prefilled → edit → save
 Toggle avail.:   switch on item row → instantly hidden/shown to customers
 Delete:          item menu "⋯" → delete → confirm
```

**Receive Order → Update Status**
```
Orders Queue (polls) → new PAID order appears in "New" column
 → open Order Detail → "Accept" (→ACCEPTED) or "Reject" (modal reason →REJECTED)
 → Accept → "Start Preparing" (→PREPARING)
          → "Out for Delivery" (→OUT_FOR_DELIVERY)
          → "Mark Delivered" (→DELIVERED)
 (each transition: validated by state machine + writes OrderStatusEvent)
```

### Admin

**Manage Restaurants**
```
Admin → Restaurants → filter [Pending]
 → click applicant → Restaurant Review (profile + menu preview)
 → "Approve" (→APPROVED, now customer-visible) or "Suspend" (→SUSPENDED)
```

**Manage Users**
```
Admin → Users → search/filter by role
 → click user → detail (role, status, orders count)
 → suspend / restore
```

**View Orders / Platform Monitoring**
```
Admin → Overview → KPI cards (restaurants, orders today, test revenue, pending approvals)
 → "Orders" → all orders table → filter by status → open order detail (read-only)
```

---

# 5. Low-Fidelity Wireframes (Step 5)

> ASCII, desktop-first. `[ ]` = button, `(•)`/`( )` = radio, `[x]`/`[ ]` = checkbox/toggle, `▾` = dropdown, `🔍` = search, `…` = repeats.

### S1 — Landing (Public)
```
┌─────────────────────────────────────────────────────────────┐
│ LOGO                                   [Browse]  [Sign in]    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│        Order food from local restaurants                      │
│        ───────────────────────────────────                   │
│        [ Browse restaurants ]   [ For restaurants ]           │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  [How it works]   [Discover]   [Order]   [Track]              │
└─────────────────────────────────────────────────────────────┘
```

### S2 — Sign In (Public)
```
┌──────────────────────────────┐
│           Sign in            │
│  Email    [______________]   │
│  Password [______________]   │
│           [   Sign in    ]   │
│  ───────────────────────     │
│  No account?  [Sign up]      │
│  (error: "Invalid credentials")
└──────────────────────────────┘
```

### S3 — Sign Up (Public)
```
┌──────────────────────────────────────────┐
│              Create account               │
│  I am a:  (•) Customer   ( ) Restaurant   │
│  Name     [__________________________]    │
│  Email    [__________________________]    │
│  Password [__________________________]    │
│           [        Create account     ]   │
│  (Restaurant sign-up → profile next →     │
│   account starts as PENDING)              │
└──────────────────────────────────────────┘
```

### S4 — Discovery / Home (Customer)  ★core
```
┌─────────────────────────────────────────────────────────────┐
│ LOGO   🔍 [ search restaurants or food............ ]  🛒(2) ▾Account│
├──────────────┬──────────────────────────────────────────────┤
│ FILTERS      │  Restaurants near you                         │
│ Cuisine ▾    │  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  [ ] Pizza   │  │ [img]   │ │ [img]   │ │ [img]   │          │
│  [ ] Indian  │  │ Name    │ │ Name    │ │ Name    │          │
│  [ ] Sushi   │  │ Cuisine │ │ Cuisine │ │ Cuisine │          │
│ Sort ▾       │  │ ~30 min │ │ ~25 min │ │ ~40 min │          │
│  • Relevance │  │ [View]  │ │ [View]  │ │ [View]  │          │
│  • Fastest   │  └─────────┘ └─────────┘ └─────────┘          │
│              │  …                                            │
└──────────────┴──────────────────────────────────────────────┘
```

### S5 — Restaurant Detail (Customer)  ★core
```
┌─────────────────────────────────────────────────────────────┐
│ LOGO   🔍 [ ............ ]                         🛒(2) ▾Acct │
├─────────────────────────────────────────────────────────────┤
│ ← Back     [ Banner image ]                                   │
│ Restaurant Name   ·   Cuisine   ·   ~30 min   ·   Open        │
├───────────────────────────────┬─────────────────────────────┤
│ Categories (sticky)           │  CART                        │
│  • Starters                   │  ┌─────────────────────────┐ │
│  • Mains                      │  │ Margherita   x1   $9.00 │ │
│  • Drinks                     │  │ Coke         x1   $2.00 │ │
│                               │  │ ─────────────────────── │ │
│ STARTERS                      │  │ Subtotal         $11.00 │ │
│ ┌───────────────────────────┐ │  │ [  Go to cart  ]        │ │
│ │ [img] Garlic Bread  $4.00 │ │  └─────────────────────────┘ │
│ │ desc…            [ Add + ]│ │                              │
│ ├───────────────────────────┤ │  (unavailable item:          │
│ │ [img] Soup (Sold out) [—] │ │   greyed, no Add)            │
│ └───────────────────────────┘ │                              │
│ MAINS …                       │                              │
└───────────────────────────────┴─────────────────────────────┘
```

### S6 — Cart (Customer)  ★core
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to restaurant            Your cart — [Restaurant Name] │
├─────────────────────────────────────────────────────────────┤
│ Item               Qty            Price        Remove         │
│ Margherita        [- 1 +]         $9.00         [x]           │
│ Coke              [- 1 +]         $2.00         [x]           │
│ ───────────────────────────────────────────────────────────  │
│ Subtotal                          $11.00                      │
│ Delivery fee                      $2.00                       │
│ Total                             $13.00                      │
│                                   [  Proceed to checkout  ]   │
└─────────────────────────────────────────────────────────────┘
```

### S7 — Checkout (Customer)  ★core
```
┌─────────────────────────────────────────────────────────────┐
│ Checkout                                                      │
├───────────────────────────────┬─────────────────────────────┤
│ Delivery address              │  ORDER SUMMARY               │
│ (•) 12 Main St, City          │  Margherita  x1     $9.00    │
│ ( ) 8 Oak Ave, City           │  Coke        x1     $2.00    │
│ [ + Add new address ]         │  ─────────────────────────   │
│                               │  Subtotal           $11.00   │
│ Payment                       │  Delivery fee        $2.00   │
│  Pay securely via Stripe      │  Total              $13.00   │
│  (test mode)                  │                              │
│                               │  [     Pay $13.00      ]     │
│ (error: "Payment failed —     │                              │
│  please try again")           │                              │
└───────────────────────────────┴─────────────────────────────┘
        │  Pay → redirect to Stripe Checkout (hosted) → return  │
```

### S8 — Order Tracking (Customer)  ★core  (polls every few seconds)
```
┌─────────────────────────────────────────────────────────────┐
│ Order #1042 — [Restaurant Name]            (auto-refreshing)  │
├─────────────────────────────────────────────────────────────┤
│  ● Placed            12:01                                    │
│  ● Accepted          12:03                                    │
│  ● Preparing         12:06   ◀ current                        │
│  ○ Out for delivery  —                                        │
│  ○ Delivered         —                                        │
│ ───────────────────────────────────────────────────────────  │
│ Items: Margherita x1, Coke x1            Total $13.00         │
│ Deliver to: 12 Main St, City                                  │
│ [ Cancel order ]  (enabled only before "Accepted")           │
└─────────────────────────────────────────────────────────────┘
```

### S9 — Orders / History (Customer)
```
┌─────────────────────────────────────────────────────────────┐
│ ▾Account ▸ Orders                                             │
├─────────────────────────────────────────────────────────────┤
│ ACTIVE                                                        │
│  #1042  [Restaurant]  Preparing      $13.00   [ Track ]       │
│ PAST                                                          │
│  #1031  [Restaurant]  Delivered      $22.00   [ View ]       │
│  #1020  [Restaurant]  Cancelled      $ 9.00   [ View ]       │
│  …                                                            │
└─────────────────────────────────────────────────────────────┘
```

### S10 — Restaurant Orders Queue (Restaurant)  ★core  (polls)
```
┌───────────┬───────────────────────────────────────────────────┐
│ SIDEBAR   │  Orders                              [Restaurant ▾] │
│ ▸Orders   ├──────────────┬──────────────┬─────────────────────┤
│  Menu     │ NEW          │ IN PROGRESS  │ COMPLETED           │
│  Profile  │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐        │
│           │ │ #1042    │ │ │ #1039    │ │ │ #1031    │        │
│           │ │ 2 items  │ │ │ Preparing│ │ │ Delivered│        │
│           │ │ $13.00   │ │ │ $20.00   │ │ │ $22.00   │        │
│           │ │[Open]    │ │ │[Open]    │ │ │[View]    │        │
│           │ └──────────┘ │ └──────────┘ │ └──────────┘        │
│           │ …            │ …            │ …                   │
└───────────┴──────────────┴──────────────┴─────────────────────┘
```

### S11 — Order Detail (Restaurant)  ★core
```
┌─────────────────────────────────────────────────────────────┐
│ ← Queue     Order #1042            Status: PLACED            │
├─────────────────────────────────────────────────────────────┤
│ Customer: Maya            Placed: 12:01      Paid ✓          │
│ Deliver to: 12 Main St, City                                 │
│ ───────────────────────────────────────────────────────────  │
│ Items                                                         │
│  Margherita   x1    $9.00                                     │
│  Coke         x1    $2.00                                     │
│  Subtotal $11.00 · Fee $2.00 · Total $13.00                   │
│ ───────────────────────────────────────────────────────────  │
│ Actions (depend on current state):                            │
│  PLACED →  [ Accept ]   [ Reject ]                            │
│  ACCEPTED → [ Start preparing ]                               │
│  PREPARING → [ Out for delivery ]                             │
│  OUT_FOR_DELIVERY → [ Mark delivered ]                        │
└─────────────────────────────────────────────────────────────┘
```

### S12 — Menu Manager (Restaurant)  ★core
```
┌───────────┬───────────────────────────────────────────────────┐
│ SIDEBAR   │  Menu                         [ + Category ]        │
│  Orders   ├───────────────────────────────────────────────────┤
│ ▸Menu     │ ▾ STARTERS                          [ + Item ]      │
│  Profile  │   Garlic Bread   $4.00   Available [x]   [Edit][⋯] │
│           │   Soup           $5.00   Available [ ]   [Edit][⋯] │
│           │ ▾ MAINS                             [ + Item ]      │
│           │   Margherita     $9.00   Available [x]   [Edit][⋯] │
│           │   …                                                 │
└───────────┴───────────────────────────────────────────────────┘
   Add/Edit Item modal:
   ┌────────────────────────────┐
   │ Item name [____________]   │
   │ Price     [____] (cents)   │
   │ Desc      [____________]   │
   │ Image URL [____________]   │
   │ Available [x]              │
   │      [Cancel] [ Save ]     │
   └────────────────────────────┘
```

### S13 — Restaurant Profile / Hours (Restaurant)
```
┌───────────┬───────────────────────────────────────────────────┐
│ SIDEBAR   │  Profile                                           │
│  Orders   │  Name        [_____________________]               │
│  Menu     │  Cuisine     [ Pizza ▾ ]                            │
│ ▸Profile  │  Hours       [ Mon–Sun 10:00–22:00 ]               │
│           │  Delivery area [ City center; 5km ]                │
│           │  Status: APPROVED                                   │
│           │              [ Save changes ]                       │
└───────────┴───────────────────────────────────────────────────┘
```

### S14 — Admin Overview (Admin)  ★core
```
┌───────────┬───────────────────────────────────────────────────┐
│ SIDEBAR   │  Platform overview                                 │
│ ▸Overview ├───────────────────────────────────────────────────┤
│  Restaur. │ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐ │
│  Users    │ │Restaur.│ │Orders  │ │Revenue │ │Pending       │ │
│  Orders   │ │  24    │ │today 58│ │$1,240  │ │approvals  3  │ │
│           │ └────────┘ └────────┘ └────────┘ └──────────────┘ │
│           │ Recent orders                                      │
│           │  #1042  Restaurant  Preparing   $13.00             │
│           │  #1041  Restaurant  Delivered   $20.00             │
│           │  …                                                 │
└───────────┴───────────────────────────────────────────────────┘
```

### S15 — Admin Restaurants (Admin)  ★core
```
┌───────────┬───────────────────────────────────────────────────┐
│ SIDEBAR   │  Restaurants     Filter: [All|Pending|Approved|Susp]│
│  Overview ├───────────────────────────────────────────────────┤
│ ▸Restaur. │ Name        Cuisine   Status     Actions           │
│  Users    │ Mario's     Pizza     PENDING    [Review][Approve]  │
│  Orders   │ Spice Hub   Indian    APPROVED   [View][Suspend]    │
│           │ Sushi Go    Sushi     SUSPENDED  [View][Restore]    │
│           │ …                                                   │
└───────────┴───────────────────────────────────────────────────┘
   Restaurant Review modal/page: profile + menu preview + [Approve][Reject]
```

### S16 — Admin Users (Admin)
```
┌───────────┬───────────────────────────────────────────────────┐
│ SIDEBAR   │  Users        🔍[ search ]   Role:[All|Cust|Rest]   │
│  …        ├───────────────────────────────────────────────────┤
│ ▸Users    │ Name     Email            Role        Actions       │
│           │ Maya     maya@x.com       CUSTOMER    [View][Suspend]│
│           │ Sam      sam@x.com        RESTAURANT  [View][Suspend]│
│           │ …                                                   │
└───────────┴───────────────────────────────────────────────────┘
```

### S17 — Admin Orders (Admin)
```
┌───────────┬───────────────────────────────────────────────────┐
│ SIDEBAR   │  Orders     Status:[All▾]  Date:[range]             │
│  …        ├───────────────────────────────────────────────────┤
│ ▸Orders   │ #     Restaurant   Customer  Status     Total       │
│           │ 1042  Mario's      Maya      Preparing  $13.00 [View]│
│           │ 1041  Spice Hub     Ken       Delivered  $20.00 [View]│
│           │ …                                                   │
└───────────┴───────────────────────────────────────────────────┘
```

---

# 6. Dashboard Layouts (Step 6) — desktop-first

### Customer Account (tabbed, top-nav context)
```
┌─────────────────────────────────────────────────────────────┐
│ Account: [ Profile ] [ Orders ] [ Addresses ]                │
├─────────────────────────────────────────────────────────────┤
│ PROFILE:  Name [____]  Email [____]   [Save]                 │
│ ORDERS:   active + past list (see S9)                        │
│ ADDRESSES: list of saved addresses  [ + Add ] [Edit][Delete] │
└─────────────────────────────────────────────────────────────┘
```
**Widget placement / why:** tabs (not separate pages) because these are light, related self-service tasks; Orders is the most-used tab so it's the natural default once a customer has history.

### Restaurant Dashboard (sidebar shell)
```
┌──────────┬──────────────────────────────────────────────────┐
│ Orders ▸ │  [ Orders (S10) | Order Detail (S11) ]            │
│ Menu     │  [ Menu Manager (S12) ]                           │
│ Profile  │  [ Profile/Hours (S13) ]                          │
│ (Analytics – Future) ........... greyed/"coming soon"        │
└──────────┴──────────────────────────────────────────────────┘
```
**Widget placement / why:** Orders is the top sidebar item and default landing because fulfillment is the owner's primary, time-sensitive job. Menu and Profile are setup tasks done less often, so they sit below. "Analytics" is shown as a deliberately disabled Future-Scope placeholder so the IA doesn't need rework later.

### Admin Dashboard (sidebar shell)
```
┌──────────┬──────────────────────────────────────────────────┐
│ Overview▸│  KPI cards + recent activity (S14)                │
│ Restaur. │  approval table (S15)                             │
│ Users    │  user table (S16)                                 │
│ Orders   │  all-orders table (S17)                           │
└──────────┴──────────────────────────────────────────────────┘
```
**Widget placement / why:** Overview leads because an operator wants health-at-a-glance first; the four KPI cards (restaurants, orders today, revenue, **pending approvals**) put the most action-triggering metric — approvals — where it can't be missed. Operational tables follow in workflow order.

---

# 7. Component Inventory (Step 7)

| Component | Purpose | Reusability | Screens used |
|---|---|---|---|
| **TopNav (customer)** | Logo, search, cart, account | High | S4–S9 |
| **Sidebar (dashboard)** | Role nav shell | High | S10–S17 |
| **SearchBar** | Query restaurants/food | Medium | S4, S5, S16, S17 |
| **FilterPanel** | Cuisine/sort/status filters | High | S4, S15, S16, S17 |
| **RestaurantCard** | Summarize a restaurant | High | S4 |
| **MenuItemRow/Card** | Item with price + Add/avail | High | S5, S12 |
| **CartSummary** | Line items + totals | High | S5 (mini), S6, S7 |
| **QtyStepper** | `- n +` quantity control | High | S5, S6 |
| **OrderStatusBadge** | Render lifecycle state | High | S8–S11, S17 |
| **StatusTimeline** | Vertical step tracker | Medium | S8 |
| **OrderCard** | Compact order in a column | High | S10 |
| **DataTable** | Sortable/filterable rows + row actions | High | S15, S16, S17, S9 |
| **KPICard** | Single metric tile | High | S14 |
| **Form fields** (Input/Select/Toggle/Radio) | Data entry | High | most screens |
| **Modal** | Item/address/confirm dialogs | High | S5, S6, S12, S15 |
| **Button** (primary/secondary/destructive) | Actions | High | all |
| **EmptyState** | "Nothing here yet" block | High | many |
| **ErrorBanner / InlineError** | Surface failures | High | S2, S7, data screens |
| **Tabs** | Section switching | Medium | Account |
| **Avatar/AccountMenu** | Account dropdown | Medium | top nav |

---

# 8. State Design (Step 8)

For each important screen: **Loading / Empty / Error / Success**.

| Screen | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Discovery (S4) | Skeleton cards | "No restaurants in your area yet" + suggestion | "Couldn't load restaurants [Retry]" | Grid of cards |
| Restaurant Detail (S5) | Skeleton menu | "This menu is being set up" | "Restaurant unavailable" → back | Menu by category |
| Cart (S6) | — (local) | "Your cart is empty [Browse]" | Item no longer available warning | Editable line items |
| Checkout (S7) | Spinner on Pay | No address → prompt to add | "Payment failed — try again" | Redirect → Stripe → Tracking |
| Order Tracking (S8) | "Loading order…" | n/a | "Couldn't refresh status [Retry]" | Timeline w/ current step |
| Orders/History (S9) | Skeleton rows | "No orders yet [Browse]" | "Couldn't load orders" | Active + past lists |
| Restaurant Queue (S10) | Skeleton columns | "No incoming orders" | "Couldn't load queue" | 3 status columns |
| Menu Manager (S12) | Skeleton list | "Add your first item" | Save failed inline | Categories + items |
| Admin tables (S15–17) | Skeleton rows | "No pending approvals" / "No rows" | "Couldn't load" | Populated table |

**Representative empty + error wireframes**
```
EMPTY (Restaurant Queue)            ERROR (Discovery)
┌──────────────────────┐            ┌──────────────────────┐
│      (icon)          │            │      (icon)          │
│  No incoming orders  │            │ Couldn't load        │
│  New paid orders     │            │ restaurants.         │
│  appear here.        │            │      [ Retry ]       │
└──────────────────────┘            └──────────────────────┘
```

---

# 9. Responsive Strategy (Step 9) — structure only

| Breakpoint | Layout behavior |
|---|---|
| **Desktop (≥1024px)** | Two/three-column layouts. Customer: filters left + grid right; Restaurant Detail: menu + sticky cart side panel. Dashboards: persistent left sidebar + content. Tables show all columns. |
| **Tablet (~768–1023px)** | Collapse to 2 columns. Filters become a top **[Filters ▾]** drawer. Cart side panel becomes a sticky bottom bar "View cart (2) — $13.00". Sidebar collapses to icons. Tables drop low-priority columns. |
| **Mobile (<768px)** | Single column. Top nav condenses to logo + 🔍 + 🛒 + ☰. Restaurant menu cart becomes a **sticky bottom cart bar** → full-screen Cart. Dashboard sidebar becomes a hamburger drawer; order "columns" become **stacked, swipeable status sections** or a status-filter dropdown. Tables become **stacked cards** (label: value). Modals go full-screen. |

**Key structural changes (not visual):** filter rail → drawer; side cart → bottom bar; sidebar → hamburger; multi-column queue → stacked/filtered; data tables → card lists. Order-tracking timeline stays vertical at every size (already mobile-friendly).

---

# 10. Figma File Structure (Step 10)

**Pages**
```
01 - Research            (PRD summary, personas, goals)
02 - Sitemap             (the IA tree from §2)
03 - User Flows          (flow diagrams from §4)
04 - Wireframes          (low-fi frames from §5, grouped by role)
05 - Components          (the inventory from §7 as a component library)
06 - Design System       (later: color, type, spacing tokens)
07 - High-Fidelity       (later: final screens)
```

**Recommended component hierarchy (Figma)**
```
Foundations
  ├─ Spacing / Grid (8pt)
  └─ Icons
Primitives (atoms)
  ├─ Button (variant: primary | secondary | destructive; state: default/hover/disabled)
  ├─ Input / Select / Toggle / Radio / Checkbox
  └─ Badge  → OrderStatusBadge (variant per OrderStatus)
Elements (molecules)
  ├─ SearchBar
  ├─ QtyStepper
  ├─ KPICard
  ├─ FilterPanel
  └─ EmptyState / ErrorBanner / InlineError
Composites (organisms)
  ├─ RestaurantCard
  ├─ MenuItemRow
  ├─ CartSummary  (uses QtyStepper + Button)
  ├─ OrderCard    (uses OrderStatusBadge)
  ├─ StatusTimeline
  ├─ DataTable    (uses Badge + Button row actions)
  └─ Modal
Shells (templates)
  ├─ TopNav (customer)
  ├─ Sidebar (dashboard)
  └─ DashboardShell (Sidebar + content slot)
```
**Why this hierarchy:** it mirrors the §7 inventory and atomic-design layering, so a designer builds each atom once (e.g., `OrderStatusBadge`) and reuses it everywhere the lifecycle appears (queue, tracking, admin orders). That keeps the eventual high-fidelity pass consistent and fast.

---

## Coverage & limits of this document
- **Covers:** all 17 PRD screens + supporting/modal/empty/error states, every Step-4 flow, full component inventory, responsive structure, and Figma scaffolding — enough to start hi-fi design and to brief a developer on app structure.
- **Does NOT cover:** visual design (color/type/branding), exact spacing/pixel values, real microcopy, accessibility annotations (contrast/focus order), or animation — all belong to the high-fidelity/design-system phase (Figma pages 06–07). Courier/live-map and real-time push screens are intentionally absent (Future Scope per PRD).
```
