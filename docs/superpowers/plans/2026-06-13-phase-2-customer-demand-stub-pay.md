# Phase 2 — Customer Demand Side + Stub-Pay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A customer can discover an APPROVED restaurant, build a single-restaurant cart, check out, "pay" via a dev stub, and watch the order appear in the restaurant queue and advance to `READY` on a live tracking timeline.

**Architecture:** Server Components for all reads (discovery, detail, cart, checkout, tracking, history). Cart lives client-side in React context + `localStorage`, reconciled to live DB prices at checkout. Mutations are Server Actions ending in `revalidatePath`; the one polled JSON endpoint (order status) is a Route Handler with the `{ ok, data, error }` envelope. Payment is **stubbed** behind `markOrderPaid(orderId)` — a dev-only button flips `Payment PENDING → PAID`; Phase 4 swaps the trigger to Stripe without touching order creation. Two-layer authz throughout: the proxy gates `/cart /checkout /orders` to logged-in users; every action/page re-scopes to `session.user.id`.

**Tech Stack:** Next.js 16 (App Router, Server Actions, Route Handlers), React 19, Prisma 7 (client at `@/lib/generated/prisma`, singleton `@/lib/db`), Tailwind v4 + shadcn/ui, SWR (polling), Vitest (unit), Playwright (E2E).

---

## Context the implementer must know (read before starting)

- **Prisma import gotcha:** import the client from `@/lib/generated/prisma/client` and types/enums from `@/lib/generated/prisma/enums`. Use the singleton `import { prisma } from "@/lib/db"`. NEVER `@prisma/client`, NEVER `new PrismaClient()`. (`.claude/rules/data-access.md`)
- **Two-layer authz** (`.claude/rules/authorization.md`): the route guard only checks role/auth. Re-verify ownership in every action/page. Scope writes with `updateMany` + owner in `where`, or `findFirst` then act, so a foreign id is a 0-row no-op.
- **Money is integer cents** everywhere. `totalCents = subtotalCents + deliveryFeeCents`. Never floats. The ONLY cents→string conversion is a `formatCents` helper.
- **State machine is the single source of truth** (`lib/orders/state.ts`): every status change goes through `assertTransition(from, to, actor)` and appends an `OrderStatusEvent` in the same transaction. For customer cancel use actor `"CUSTOMER"` (only `PLACED → CANCELLED` is allowed).
- **Payment gates the queue:** the restaurant queue (`app/(restaurant)/_lib/queue.ts`) already filters `payment: { status: "PAID" }`. So an order is invisible to the restaurant until `markOrderPaid` runs. Do not change the queue.
- **Existing patterns to mirror:**
  - Ownership helper: `app/(restaurant)/_lib/restaurant.ts` (`getOwnedRestaurant`/`requireOwnedRestaurant`). Mirror for the customer.
  - Action shape: `app/(restaurant)/restaurant/orders/[id]/actions.ts` (`"use server"`, resolve scope, load + ownership-check, `assertTransition`, `$transaction([update, event])`, `revalidatePath`).
  - SWR poll: `app/(restaurant)/_components/queue-board.tsx` + `app/(restaurant)/restaurant/orders/queue/route.ts` (fetcher checks `body.ok`, `fallbackData`, `refreshInterval: 5000`).
  - Money + status labels: `app/(restaurant)/_lib/format.ts` (`formatCents`, `statusLabel`, `orderRef`).
  - Page shell: `app/(customer)/browse/page.tsx` uses `<AppHeader title=... />` then a `<main className="mx-auto max-w-5xl px-6 py-12">`.
- **shadcn/ui available:** only `button`, `card`, `input`, `label` exist in `components/ui/`. Do not import other shadcn components — compose with these + Tailwind.
- **Routes already guarded for login** (`auth.config.ts` `CUSTOMER_PREFIXES`): `/account`, `/cart`, `/checkout`, `/orders`. `/browse` and `/restaurants/[id]` are PUBLIC (guests can browse). Do NOT edit `auth.config.ts` or `proxy.ts` in this phase.
- **Money formatting:** the roadmap suggests consolidating the three `formatCents` copies into `lib/money.ts`. We DEFER that (it would touch restaurant + admin files and risk a merge conflict with the parallel driver worktree). Instead create a customer-local `app/(customer)/_lib/format.ts` mirroring the restaurant one. Note the consolidation as a Phase 6 follow-up.
- **Seed:** do NOT modify `prisma/seed.ts` in this phase (it is a shared-file merge hotspot with the driver worktree). The E2E creates its own order. `customer@demo.test` / `password123` already exists.
- **Next.js 16:** `params` in pages/route handlers is a Promise — `await params`. Read the dynamic-routes guide in `node_modules/next/dist/docs/` if unsure.

## File structure (created/modified in this phase)

| File | Responsibility |
|---|---|
| `lib/orders/fees.ts` | `FLAT_DELIVERY_FEE_CENTS` constant (single source of the delivery fee). NEW |
| `lib/orders/payment.ts` | `markOrderPaid(orderId)` — idempotent stub that flips Payment PENDING→PAID. NEW |
| `app/(customer)/_lib/format.ts` | `formatCents` (customer-local copy mirroring restaurant). NEW |
| `app/(customer)/_lib/cart.ts` | Pure, immutable cart model + ops (single-restaurant rule, cents totals). NEW |
| `app/(customer)/_lib/cart.test.ts` | Vitest unit tests for the cart core. NEW |
| `app/(customer)/_lib/customer.ts` | `getCustomer()`/`requireCustomer()` ownership helpers (mirror restaurant.ts). NEW |
| `app/(customer)/_lib/cart-context.tsx` | Client cart provider (localStorage `fd_cart_v1`) + `useCart` hook. NEW |
| `app/(customer)/layout.tsx` | Wraps customer routes in `<CartProvider>`. NEW |
| `app/(customer)/_components/add-to-cart-button.tsx` | Client button; single-restaurant conflict confirm. NEW |
| `app/(customer)/_components/cart-button.tsx` | Client header cart link with item-count badge. NEW |
| `app/(customer)/browse/page.tsx` | Discovery: APPROVED grid + name search + cuisine filter (GET params). MODIFY |
| `app/(customer)/restaurants/[id]/page.tsx` | Restaurant detail: APPROVED-gated, menu by category, add-to-cart. NEW |
| `app/(customer)/cart/page.tsx` | Cart review: lines, qty controls, subtotal, proceed to checkout. NEW |
| `app/(customer)/checkout/page.tsx` | Checkout form: address + order summary. NEW |
| `app/(customer)/checkout/actions.ts` | `placeOrder` — server re-validate, snapshot, create Order+Items+Payment. NEW |
| `app/(customer)/orders/[id]/page.tsx` | Confirmation/tracking: summary + timeline + dev MarkPaid + SWR poll. NEW |
| `app/(customer)/orders/[id]/actions.ts` | `devMarkPaid`, `cancelOrder` (ownership-scoped). NEW |
| `app/(customer)/orders/[id]/status/route.ts` | Polled JSON `{ ok, data, error }`: status + timeline (owner-scoped). NEW |
| `app/(customer)/orders/[id]/_components/order-tracker.tsx` | Client: SWR poll, render timeline, stop at terminal. NEW |
| `app/(customer)/orders/[id]/_components/mark-paid-button.tsx` | Client dev-only "Mark as paid" button. NEW |
| `app/(customer)/orders/page.tsx` | Order history scoped to `userId`. NEW |
| `e2e/customer.spec.ts` | Happy path + ownership 404 + cancel + single-restaurant conflict. NEW |

---

## Task 1: Delivery fee constant

**Files:**
- Create: `lib/orders/fees.ts`
- Test: `lib/orders/fees.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/orders/fees.test.ts
import { describe, expect, it } from "vitest";
import { FLAT_DELIVERY_FEE_CENTS } from "./fees";

describe("delivery fee", () => {
  it("is a positive integer number of cents (no floats)", () => {
    expect(Number.isInteger(FLAT_DELIVERY_FEE_CENTS)).toBe(true);
    expect(FLAT_DELIVERY_FEE_CENTS).toBeGreaterThan(0);
  });

  it("matches the seed fixtures' fee ($2.99)", () => {
    expect(FLAT_DELIVERY_FEE_CENTS).toBe(299);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run lib/orders/fees.test.ts`
Expected: FAIL — cannot find module `./fees`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/orders/fees.ts
// Flat delivery fee, in integer cents. Single source of truth for the fee the
// customer pays and the driver later earns. Snapshotted onto Order.deliveryFeeCents
// at checkout so later changes never affect past orders. (CLAUDE.md: money = cents.)
export const FLAT_DELIVERY_FEE_CENTS = 299;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run lib/orders/fees.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/orders/fees.ts lib/orders/fees.test.ts
git commit -m "feat(orders): flat delivery fee constant (Phase 2)"
```

---

## Task 2: Cart core (pure, immutable)

**Files:**
- Create: `app/(customer)/_lib/cart.ts`
- Test: `app/(customer)/_lib/cart.test.ts`

The cart is a pure data model with pure transition functions — no React, no storage. This is where the single-restaurant rule and cents math live, so it is exhaustively unit-tested. The provider (Task 4) wraps these with localStorage.

- [ ] **Step 1: Write the failing test**

```ts
// app/(customer)/_lib/cart.test.ts
import { describe, expect, it } from "vitest";
import {
  EMPTY_CART,
  addItem,
  removeItem,
  setQuantity,
  cartSubtotalCents,
  cartItemCount,
  isDifferentRestaurant,
  type Cart,
} from "./cart";

const mario = { id: "r_mario", name: "Mario's Pizza" };
const spice = { id: "r_spice", name: "Spice Hub" };
const margherita = { menuItemId: "m_marg", name: "Margherita", priceCents: 900 };
const pepperoni = { menuItemId: "m_pep", name: "Pepperoni", priceCents: 1100 };

describe("cart core", () => {
  it("adds an item to an empty cart and stamps the restaurant", () => {
    const cart = addItem(EMPTY_CART, mario, margherita);
    expect(cart.restaurantId).toBe("r_mario");
    expect(cart.restaurantName).toBe("Mario's Pizza");
    expect(cart.items).toEqual([{ ...margherita, quantity: 1 }]);
  });

  it("does NOT mutate the input cart (immutability)", () => {
    const before: Cart = EMPTY_CART;
    const after = addItem(before, mario, margherita);
    expect(before.items).toHaveLength(0); // original untouched
    expect(after).not.toBe(before);
  });

  it("increments quantity when the same item is added again", () => {
    let cart = addItem(EMPTY_CART, mario, margherita);
    cart = addItem(cart, mario, margherita);
    expect(cart.items).toEqual([{ ...margherita, quantity: 2 }]);
  });

  it("keeps separate lines for different items of the same restaurant", () => {
    let cart = addItem(EMPTY_CART, mario, margherita);
    cart = addItem(cart, mario, pepperoni);
    expect(cart.items).toHaveLength(2);
  });

  it("detects a different-restaurant conflict", () => {
    const cart = addItem(EMPTY_CART, mario, margherita);
    expect(isDifferentRestaurant(cart, "r_spice")).toBe(true);
    expect(isDifferentRestaurant(cart, "r_mario")).toBe(false);
    expect(isDifferentRestaurant(EMPTY_CART, "r_spice")).toBe(false); // empty = no conflict
  });

  it("setQuantity changes a line, and quantity <= 0 removes it", () => {
    let cart = addItem(EMPTY_CART, mario, margherita);
    cart = setQuantity(cart, "m_marg", 3);
    expect(cart.items[0].quantity).toBe(3);
    cart = setQuantity(cart, "m_marg", 0);
    expect(cart.items).toHaveLength(0);
  });

  it("removeItem drops the line; removing the last item clears the restaurant", () => {
    let cart = addItem(EMPTY_CART, mario, margherita);
    cart = removeItem(cart, "m_marg");
    expect(cart.items).toHaveLength(0);
    expect(cart.restaurantId).toBeNull();
    expect(cart.restaurantName).toBeNull();
  });

  it("subtotal is the integer-cents sum of price * quantity", () => {
    let cart = addItem(EMPTY_CART, mario, margherita); // 900
    cart = addItem(cart, mario, margherita); // 900 -> qty 2 = 1800
    cart = addItem(cart, mario, pepperoni); // 1100
    expect(cartSubtotalCents(cart)).toBe(1800 + 1100); // 2900
    expect(Number.isInteger(cartSubtotalCents(cart))).toBe(true);
  });

  it("itemCount sums quantities (not lines)", () => {
    let cart = addItem(EMPTY_CART, mario, margherita);
    cart = addItem(cart, mario, margherita);
    cart = addItem(cart, mario, pepperoni);
    expect(cartItemCount(cart)).toBe(3);
  });

  it("empty cart has zero subtotal and zero items", () => {
    expect(cartSubtotalCents(EMPTY_CART)).toBe(0);
    expect(cartItemCount(EMPTY_CART)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run "app/(customer)/_lib/cart.test.ts"`
Expected: FAIL — cannot find module `./cart`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/(customer)/_lib/cart.ts
// Pure, immutable cart model. No React, no storage — the provider (cart-context)
// wraps these with localStorage. One order = one restaurant (CLAUDE.md), so the
// cart stamps the restaurant on first add and clears it when emptied. Money is
// integer cents throughout.

export interface CartItem {
  menuItemId: string;
  name: string; // snapshot for display; re-validated server-side at checkout
  priceCents: number; // snapshot for display; re-validated server-side at checkout
  quantity: number;
}

export interface Cart {
  restaurantId: string | null;
  restaurantName: string | null;
  items: CartItem[];
}

export const EMPTY_CART: Cart = { restaurantId: null, restaurantName: null, items: [] };

interface RestaurantRef {
  id: string;
  name: string;
}
type AddableItem = Omit<CartItem, "quantity">;

/** True if the cart already holds items from a DIFFERENT restaurant. Empty = false. */
export function isDifferentRestaurant(cart: Cart, restaurantId: string): boolean {
  return cart.restaurantId !== null && cart.restaurantId !== restaurantId;
}

/**
 * Add `item` from `restaurant` to the cart (default qty 1). Assumes the caller
 * has already resolved any different-restaurant conflict (see isDifferentRestaurant);
 * if the cart is empty it adopts this restaurant. Returns a NEW cart.
 */
export function addItem(
  cart: Cart,
  restaurant: RestaurantRef,
  item: AddableItem,
  quantity = 1,
): Cart {
  const base: Cart =
    cart.restaurantId === restaurant.id
      ? cart
      : { restaurantId: restaurant.id, restaurantName: restaurant.name, items: [] };

  const existing = base.items.find((i) => i.menuItemId === item.menuItemId);
  const items = existing
    ? base.items.map((i) =>
        i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + quantity } : i,
      )
    : [...base.items, { ...item, quantity }];

  return { ...base, items };
}

/** Set an item's quantity. quantity <= 0 removes the line. Returns a NEW cart. */
export function setQuantity(cart: Cart, menuItemId: string, quantity: number): Cart {
  if (quantity <= 0) return removeItem(cart, menuItemId);
  return {
    ...cart,
    items: cart.items.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i)),
  };
}

/** Remove a line. If the cart becomes empty, clear the restaurant stamp. Returns a NEW cart. */
export function removeItem(cart: Cart, menuItemId: string): Cart {
  const items = cart.items.filter((i) => i.menuItemId !== menuItemId);
  if (items.length === 0) return EMPTY_CART;
  return { ...cart, items };
}

/** Integer-cents sum of price * quantity over all lines. */
export function cartSubtotalCents(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
}

/** Total quantity across all lines (badge count). */
export function cartItemCount(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.quantity, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run "app/(customer)/_lib/cart.test.ts"`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add "app/(customer)/_lib/cart.ts" "app/(customer)/_lib/cart.test.ts"
git commit -m "feat(customer): pure immutable cart core + unit tests (Phase 2)"
```

---

## Task 3: Customer ownership helper + money formatter

**Files:**
- Create: `app/(customer)/_lib/customer.ts`
- Create: `app/(customer)/_lib/format.ts`

Mirrors `app/(restaurant)/_lib/restaurant.ts` and `_lib/format.ts`. No new behavior to unit-test (they wrap `auth()`/string formatting); verified by build + the E2E in Task 10. Commit when the build is clean.

- [ ] **Step 1: Write the customer ownership helper**

```ts
// app/(customer)/_lib/customer.ts
// Customer scope helpers — the SECOND authorization layer for customer data.
// The proxy only checks that SOMEONE is logged in for /cart /checkout /orders;
// every action/page that reads or mutates an order MUST scope to this userId.
import { auth } from "@/lib/auth";

/** Current customer's userId, or null when there is no session. Use in pages. */
export async function getCustomerId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Like getCustomerId but throws when unauthenticated. Use inside Server Actions. */
export async function requireCustomerId(): Promise<string> {
  const id = await getCustomerId();
  if (!id) throw new Error("Not authenticated");
  return id;
}
```

- [ ] **Step 2: Write the customer-local money formatter**

```ts
// app/(customer)/_lib/format.ts
// Money is integer cents everywhere (CLAUDE.md). This is the ONLY place the
// customer area turns cents into a $ string. (Mirrors (restaurant)/_lib/format.ts;
// consolidating the copies into lib/money.ts is a deferred Phase 6 cleanup.)
import type { OrderStatus } from "@/lib/generated/prisma/enums";

/** 1300 -> "$13.00". Pure formatting; never used for arithmetic. */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Human label for a status, e.g. OUT_FOR_DELIVERY -> "Out for delivery". */
export function statusLabel(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    PLACED: "Placed",
    ACCEPTED: "Accepted",
    PREPARING: "Preparing",
    READY: "Ready",
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Delivered",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  };
  return map[status];
}

/** Short order reference from a cuid, e.g. "#a1b2c3". */
export function orderRef(id: string): string {
  return `#${id.slice(-6)}`;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm exec tsc --noEmit` (or `pnpm build` if tsc is not wired standalone)
Expected: no errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add "app/(customer)/_lib/customer.ts" "app/(customer)/_lib/format.ts"
git commit -m "feat(customer): ownership helper + money formatter (Phase 2)"
```

---

## Task 4: Cart provider + customer layout

**Files:**
- Create: `app/(customer)/_lib/cart-context.tsx`
- Create: `app/(customer)/layout.tsx`

Client context holding the cart in `localStorage` (`fd_cart_v1`), exposing `useCart`. The layout wraps all customer routes so any page/component can read/update the cart. Verified by build + Task 10 E2E (no isolated unit test — it's a thin React/storage wrapper over the Task 2 pure core).

- [ ] **Step 1: Write the cart context/provider**

```tsx
// app/(customer)/_lib/cart-context.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  EMPTY_CART,
  addItem as addItemCore,
  removeItem as removeItemCore,
  setQuantity as setQuantityCore,
  isDifferentRestaurant,
  type Cart,
} from "./cart";

const STORAGE_KEY = "fd_cart_v1";

interface RestaurantRef {
  id: string;
  name: string;
}
interface AddableItem {
  menuItemId: string;
  name: string;
  priceCents: number;
}

interface CartContextValue {
  cart: Cart;
  /** Add an item. If it belongs to a different restaurant, replaces the cart
   *  ONLY when `confirmReplace` returns true. Returns true if added. */
  add: (restaurant: RestaurantRef, item: AddableItem, confirmReplace: () => boolean) => boolean;
  setQty: (menuItemId: string, quantity: number) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage once on mount (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCart(JSON.parse(raw) as Cart);
    } catch {
      // ignore malformed storage — start with an empty cart
    }
    setHydrated(true);
  }, []);

  // Persist after every change (once hydrated, so we don't clobber on first paint).
  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  const add: CartContextValue["add"] = (restaurant, item, confirmReplace) => {
    if (isDifferentRestaurant(cart, restaurant.id) && !confirmReplace()) return false;
    setCart((c) => addItemCore(c, restaurant, item));
    return true;
  };

  const value: CartContextValue = {
    cart,
    add,
    setQty: (menuItemId, quantity) => setCart((c) => setQuantityCore(c, menuItemId, quantity)),
    remove: (menuItemId) => setCart((c) => removeItemCore(c, menuItemId)),
    clear: () => setCart(EMPTY_CART),
  };

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
```

- [ ] **Step 2: Write the customer layout**

```tsx
// app/(customer)/layout.tsx
// Wraps every customer route in the cart provider so the cart (localStorage)
// is shared across browse, detail, cart, and checkout.
import { CartProvider } from "./_lib/cart-context";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm build`
Expected: build succeeds; `/browse` still renders.

> Note: `<CartContext value=...>` (no `.Provider`) is the React 19 context syntax. If the installed React/TS setup rejects it, fall back to `<CartContext.Provider value=...>`.

- [ ] **Step 4: Commit**

```bash
git add "app/(customer)/_lib/cart-context.tsx" "app/(customer)/layout.tsx"
git commit -m "feat(customer): cart provider (localStorage) + layout (Phase 2)"
```

---

## Task 5: Discovery (`/browse`)

**Files:**
- Modify: `app/(customer)/browse/page.tsx`
- Create: `app/(customer)/_components/cart-button.tsx`

Server Component: lists APPROVED restaurants, with name search + cuisine filter driven by GET query params (no client state). A small client cart button in the header shows the live item count.

- [ ] **Step 1: Write the header cart button (client)**

```tsx
// app/(customer)/_components/cart-button.tsx
"use client";

import Link from "next/link";
import { useCart } from "@/app/(customer)/_lib/cart-context";
import { cartItemCount } from "@/app/(customer)/_lib/cart";

export function CartButton() {
  const { cart } = useCart();
  const count = cartItemCount(cart);
  return (
    <Link
      href="/cart"
      className="relative rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
    >
      Cart
      {count > 0 ? (
        <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
```

- [ ] **Step 2: Write the discovery page**

```tsx
// app/(customer)/browse/page.tsx
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { CartButton } from "@/app/(customer)/_components/cart-button";

// Customer discovery ("/browse"). PUBLIC — login not required to browse.
// Search (name) + cuisine filter come from GET query params so the page stays a
// Server Component (no client state). Only APPROVED restaurants are visible
// (CLAUDE.md visibility rule).
export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cuisine?: string }>;
}) {
  const { q, cuisine } = await searchParams;

  const restaurants = await prisma.restaurant.findMany({
    where: {
      status: "APPROVED",
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(cuisine ? { cuisine } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, cuisine: true, deliveryArea: true },
  });

  // Distinct cuisines across APPROVED restaurants, for the filter chips.
  const cuisines = [
    ...new Set(
      (
        await prisma.restaurant.findMany({
          where: { status: "APPROVED" },
          select: { cuisine: true },
        })
      ).map((r) => r.cuisine),
    ),
  ].sort();

  return (
    <div>
      <AppHeader title="Browse">
        <CartButton />
      </AppHeader>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Browse restaurants</h1>

        {/* Search + cuisine filter (GET form). */}
        <form className="mt-4 flex flex-wrap items-end gap-2" action="/browse">
          <div className="flex-1">
            <Input name="q" defaultValue={q ?? ""} placeholder="Search by name" />
          </div>
          {cuisine ? <input type="hidden" name="cuisine" value={cuisine} /> : null}
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/browse"
            className={`rounded-full border px-3 py-1 text-sm ${!cuisine ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            All
          </Link>
          {cuisines.map((c) => (
            <Link
              key={c}
              href={`/browse?cuisine=${encodeURIComponent(c)}`}
              className={`rounded-full border px-3 py-1 text-sm ${cuisine === c ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {c}
            </Link>
          ))}
        </div>

        {/* Results grid. */}
        {restaurants.length === 0 ? (
          <p className="mt-8 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No restaurants match your search.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((r) => (
              <Link key={r.id} href={`/restaurants/${r.id}`} className="block">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <h2 className="font-semibold">{r.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{r.cuisine}</p>
                    {r.deliveryArea ? (
                      <p className="mt-2 text-xs text-muted-foreground">{r.deliveryArea}</p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

> `AppHeader` currently takes only `title`. **Modify `components/app-header.tsx`** to accept optional `children` rendered in the right-hand cluster (before the session block): change the signature to `{ title, children }: { title: string; children?: React.ReactNode }` and render `{children}` inside the right `<div className="flex items-center gap-3">` before the session conditional. This is additive and does not change existing call sites (children is optional). Verify the restaurant/admin headers still render.

- [ ] **Step 3: Verify in the browser**

Run: `pnpm db:seed` then `pnpm dev`. Visit `/browse`. Expected: Mario's Pizza + Spice Hub cards; typing "spice" + Search filters to Spice Hub; clicking the "Indian" chip filters to Spice Hub; "All" clears.

- [ ] **Step 4: Commit**

```bash
git add "app/(customer)/browse/page.tsx" "app/(customer)/_components/cart-button.tsx" components/app-header.tsx
git commit -m "feat(customer): discovery /browse with search + cuisine filter (Phase 2)"
```

---

## Task 6: Restaurant detail (`/restaurants/[id]`)

**Files:**
- Create: `app/(customer)/restaurants/[id]/page.tsx`
- Create: `app/(customer)/_components/add-to-cart-button.tsx`

PUBLIC, but APPROVED-gated via `findFirst` so a non-approved/foreign id 404s (no info leak). Menu grouped by category; only available items get an add button.

- [ ] **Step 1: Write the add-to-cart button (client)**

```tsx
// app/(customer)/_components/add-to-cart-button.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCart } from "@/app/(customer)/_lib/cart-context";

interface Props {
  restaurant: { id: string; name: string };
  item: { menuItemId: string; name: string; priceCents: number };
}

// Adds one item to the cart. If the cart holds a different restaurant, confirms
// before replacing (single-restaurant rule, CLAUDE.md). `window.confirm` is the
// MVP UX; a styled dialog is a later polish.
export function AddToCartButton({ restaurant, item }: Props) {
  const { add } = useCart();
  const router = useRouter();

  function onAdd() {
    const added = add(restaurant, item, () =>
      window.confirm(
        "Your cart has items from another restaurant. Replace it with this item?",
      ),
    );
    if (added) router.refresh();
  }

  return (
    <Button size="sm" variant="outline" onClick={onAdd}>
      Add
    </Button>
  );
}
```

- [ ] **Step 2: Write the restaurant detail page**

```tsx
// app/(customer)/restaurants/[id]/page.tsx
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatCents } from "@/app/(customer)/_lib/format";
import { CartButton } from "@/app/(customer)/_components/cart-button";
import { AddToCartButton } from "@/app/(customer)/_components/add-to-cart-button";

// Restaurant detail ("/restaurants/[id]"). PUBLIC, but APPROVED-gated: a
// non-approved or unknown id 404s (no info leak). Menu grouped by category;
// only AVAILABLE items can be added.
export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const restaurant = await prisma.restaurant.findFirst({
    where: { id, status: "APPROVED" },
    select: {
      id: true,
      name: true,
      cuisine: true,
      hours: true,
      categories: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          items: {
            where: { isAvailable: true },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, description: true, priceCents: true },
          },
        },
      },
    },
  });

  if (!restaurant) notFound();

  const ref = { id: restaurant.id, name: restaurant.name };

  return (
    <div>
      <AppHeader title={restaurant.name}>
        <CartButton />
      </AppHeader>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {restaurant.cuisine}
          {restaurant.hours ? ` · ${restaurant.hours}` : ""}
        </p>

        {restaurant.categories.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">No menu yet.</p>
        ) : (
          restaurant.categories.map((cat) => (
            <section key={cat.id} className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">{cat.name}</h2>
              {cat.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing available here right now.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {cat.items.map((it) => (
                    <Card key={it.id}>
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div>
                          <p className="font-medium">{it.name}</p>
                          {it.description ? (
                            <p className="text-sm text-muted-foreground">{it.description}</p>
                          ) : null}
                          <p className="mt-1 text-sm font-semibold">{formatCents(it.priceCents)}</p>
                        </div>
                        <AddToCartButton
                          restaurant={ref}
                          item={{ menuItemId: it.id, name: it.name, priceCents: it.priceCents }}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Visit `/browse` → click Mario's Pizza → see Margherita ($9.00) + Pepperoni ($11.00) with Add buttons. Click Add → header cart badge increments. Visit `/restaurants/<bogus-id>` → 404. (Spice Hub is APPROVED so it renders; there is no unapproved restaurant in the seed to test the 404-on-pending case — the bogus id covers the not-found path.)

- [ ] **Step 4: Commit**

```bash
git add "app/(customer)/restaurants" "app/(customer)/_components/add-to-cart-button.tsx"
git commit -m "feat(customer): restaurant detail with menu + add-to-cart (Phase 2)"
```

---

## Task 7: Cart page (`/cart`)

**Files:**
- Create: `app/(customer)/cart/page.tsx`

Client page (needs `useCart`): lists lines with qty steppers, shows subtotal + delivery fee + total, and links to checkout. Requires login (proxy guard on `/cart`).

- [ ] **Step 1: Write the cart page**

```tsx
// app/(customer)/cart/page.tsx
"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCart } from "@/app/(customer)/_lib/cart-context";
import { cartSubtotalCents } from "@/app/(customer)/_lib/cart";
import { formatCents } from "@/app/(customer)/_lib/format";
import { FLAT_DELIVERY_FEE_CENTS } from "@/lib/orders/fees";

// NOTE: AppHeader is a Server Component (async). It cannot be rendered from this
// client page. Render a plain header here instead.
export default function CartPage() {
  const { cart, setQty, remove } = useCart();
  const subtotal = cartSubtotalCents(cart);
  const total = subtotal + FLAT_DELIVERY_FEE_CENTS;
  const empty = cart.items.length === 0;

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-card/80 px-6 py-3 backdrop-blur">
        <Link href="/browse" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            QB
          </span>
          QwikBite
        </Link>
        <span className="text-sm text-muted-foreground">Your cart</span>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Your cart</h1>

        {empty ? (
          <p className="mt-6 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            Your cart is empty.{" "}
            <Link href="/browse" className="underline">
              Browse restaurants
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">From {cart.restaurantName}</p>

            <div className="mt-6 flex flex-col gap-3">
              {cart.items.map((it) => (
                <Card key={it.menuItemId}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="font-medium">{it.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCents(it.priceCents)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Decrease ${it.name}`}
                        onClick={() => setQty(it.menuItemId, it.quantity - 1)}
                      >
                        −
                      </Button>
                      <span className="w-6 text-center">{it.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Increase ${it.name}`}
                        onClick={() => setQty(it.menuItemId, it.quantity + 1)}
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => remove(it.menuItemId)}
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-6 space-y-1 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCents(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery fee</span>
                <span>{formatCents(FLAT_DELIVERY_FEE_CENTS)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatCents(total)}</span>
              </div>
            </div>

            <Button asChild className="mt-6 w-full">
              <Link href="/checkout">Proceed to checkout</Link>
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

Sign in as `customer@demo.test`. Add 2× Margherita ($9.00) → `/cart` shows subtotal $18.00, fee $2.99, total $20.99. +/−/Remove work; removing all shows the empty state.

- [ ] **Step 3: Commit**

```bash
git add "app/(customer)/cart/page.tsx"
git commit -m "feat(customer): cart page with qty controls + totals (Phase 2)"
```

---

## Task 8: Checkout + placeOrder action

**Files:**
- Create: `app/(customer)/checkout/actions.ts`
- Create: `app/(customer)/checkout/page.tsx`

The server **re-validates** the cart against live DB prices/availability (never trusts the client's snapshot), snapshots names+prices, computes money in cents, and creates `Order(PLACED)` + `OrderItem`s + `Payment(PENDING)` + the initial `OrderStatusEvent` in one transaction. The cart contents are submitted as a hidden JSON field (the action is server-side and cannot read localStorage).

- [ ] **Step 1: Write the placeOrder action**

```ts
// app/(customer)/checkout/actions.ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCustomerId } from "@/app/(customer)/_lib/customer";
import { FLAT_DELIVERY_FEE_CENTS } from "@/lib/orders/fees";

// Shape submitted from the client cart (hidden JSON field). The server trusts
// ONLY the ids + quantities; names and prices are re-read from the DB.
interface SubmittedLine {
  menuItemId: string;
  quantity: number;
}

export interface CheckoutState {
  error?: string;
}

// Create a PLACED order from the cart. SECOND authz layer + all business rules:
//   - require a logged-in customer (scope the order to them)
//   - re-validate every line against the live menu: item exists, is available,
//     belongs to the SAME approved restaurant (reject cross-restaurant / foreign)
//   - snapshot name + priceCents from the DB (never the client) — price snapshot rule
//   - money in integer cents: subtotal = Σ price*qty, total = subtotal + fee
//   - create Order + items + Payment(PENDING) + initial event in ONE transaction
// Payment stays PENDING until markOrderPaid (stub now, Stripe in Phase 4), so the
// order is invisible to the restaurant queue until "paid".
export async function placeOrder(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const customerId = await requireCustomerId();

  const addressLine = String(formData.get("addressLine") ?? "").trim();
  if (!addressLine) return { error: "Please enter a delivery address." };

  const restaurantId = String(formData.get("restaurantId") ?? "");
  let lines: SubmittedLine[];
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Your cart could not be read. Please try again." };
  }
  if (!restaurantId || lines.length === 0) {
    return { error: "Your cart is empty." };
  }

  // Restaurant must be APPROVED (visibility rule).
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: restaurantId, status: "APPROVED" },
    select: { id: true },
  });
  if (!restaurant) return { error: "This restaurant is no longer available." };

  // Re-read each item from the DB; reject anything missing, unavailable, or not
  // belonging to this restaurant (foreign/cross-restaurant ids match nothing).
  const ids = lines.map((l) => l.menuItemId);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids }, isAvailable: true, category: { restaurantId } },
    select: { id: true, name: true, priceCents: true },
  });
  const byId = new Map(items.map((i) => [i.id, i]));

  const orderItems = lines.map((l) => {
    const item = byId.get(l.menuItemId);
    const quantity = Math.max(1, Math.floor(l.quantity));
    if (!item) throw new Error("unavailable"); // caught below -> friendly message
    return { name: item.name, priceCents: item.priceCents, quantity };
  });

  let snapshot;
  try {
    snapshot = orderItems; // forces the throw above to surface here
  } catch {
    return { error: "An item in your cart is no longer available. Please review your cart." };
  }
  // The map above can throw synchronously; guard explicitly:
  if (snapshot.length !== lines.length || snapshot.some((i) => !i)) {
    return { error: "An item in your cart is no longer available. Please review your cart." };
  }

  const subtotalCents = snapshot.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const deliveryFeeCents = FLAT_DELIVERY_FEE_CENTS;
  const totalCents = subtotalCents + deliveryFeeCents;

  const order = await prisma.order.create({
    data: {
      customerId,
      restaurantId,
      status: "PLACED",
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      addressLine,
      items: { create: snapshot },
      payment: { create: { status: "PENDING" } },
      events: { create: [{ from: null, to: "PLACED", byUserId: customerId }] },
    },
    select: { id: true },
  });

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}
```

> **Implementer note:** the `try/catch` around a synchronous `.map` that throws is awkward. Prefer this cleaner equivalent — validate first, then build:
> ```ts
> const missing = lines.find((l) => !byId.has(l.menuItemId));
> if (missing) return { error: "An item in your cart is no longer available. Please review your cart." };
> const snapshot = lines.map((l) => {
>   const item = byId.get(l.menuItemId)!;
>   return { name: item.name, priceCents: item.priceCents, quantity: Math.max(1, Math.floor(l.quantity)) };
> });
> ```
> Use this version; the throwing variant above is illustrative only. Keep the rest identical.

- [ ] **Step 2: Write the checkout page**

```tsx
// app/(customer)/checkout/page.tsx
"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCart } from "@/app/(customer)/_lib/cart-context";
import { cartSubtotalCents } from "@/app/(customer)/_lib/cart";
import { formatCents } from "@/app/(customer)/_lib/format";
import { FLAT_DELIVERY_FEE_CENTS } from "@/lib/orders/fees";
import { placeOrder, type CheckoutState } from "./actions";

const initialState: CheckoutState = {};

export default function CheckoutPage() {
  const { cart } = useCart();
  const [state, action, pending] = useActionState(placeOrder, initialState);

  const subtotal = cartSubtotalCents(cart);
  const total = subtotal + FLAT_DELIVERY_FEE_CENTS;
  const lines = cart.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity }));

  if (cart.items.length === 0) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Checkout</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your cart is empty.{" "}
          <Link href="/browse" className="underline">
            Browse restaurants
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold">Checkout</h1>
      <p className="mt-1 text-sm text-muted-foreground">From {cart.restaurantName}</p>

      <Card className="mt-6">
        <CardContent className="space-y-1 p-5 text-sm">
          {cart.items.map((it) => (
            <div key={it.menuItemId} className="flex justify-between">
              <span>
                {it.quantity} × {it.name}
              </span>
              <span>{formatCents(it.priceCents * it.quantity)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Delivery fee</span>
            <span>{formatCents(FLAT_DELIVERY_FEE_CENTS)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCents(total)}</span>
          </div>
        </CardContent>
      </Card>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="restaurantId" value={cart.restaurantId ?? ""} />
        <input type="hidden" name="lines" value={JSON.stringify(lines)} />
        <div className="space-y-2">
          <Label htmlFor="addressLine">Delivery address</Label>
          <Input id="addressLine" name="addressLine" required placeholder="12 MG Road, Bengaluru" />
        </div>
        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Placing order…" : "Place order"}
        </Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Signed in as customer with 2× Margherita: `/checkout` shows summary + total $20.99. Submit with an address → redirected to `/orders/<id>`. The order is created PLACED + PENDING (not yet in the restaurant queue — verified in Task 8/10).

- [ ] **Step 4: Commit**

```bash
git add "app/(customer)/checkout"
git commit -m "feat(customer): checkout + placeOrder (server re-validates, snapshots, tx) (Phase 2)"
```

---

## Task 9: Stub payment + confirmation/tracking (`/orders/[id]`)

**Files:**
- Create: `lib/orders/payment.ts`
- Create: `app/(customer)/orders/[id]/actions.ts`
- Create: `app/(customer)/orders/[id]/status/route.ts`
- Create: `app/(customer)/orders/[id]/_components/mark-paid-button.tsx`
- Create: `app/(customer)/orders/[id]/_components/order-tracker.tsx`
- Create: `app/(customer)/orders/[id]/page.tsx`

- [ ] **Step 1: Write the stub-payment helper**

```ts
// lib/orders/payment.ts
// Stub payment seam. markOrderPaid flips Payment PENDING -> PAID. This is the
// SINGLE place payment becomes PAID; Phase 4 will call the SAME function from the
// Stripe webhook, so order creation never changes. Idempotent: the predicate
// matches only PENDING, so a replay/double-click changes 0 rows.
import { prisma } from "@/lib/db";

/** Mark an order paid. Returns true if THIS call flipped it (false if already paid/absent). */
export async function markOrderPaid(orderId: string): Promise<boolean> {
  const result = await prisma.payment.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: "PAID" },
  });
  return result.count > 0;
}
```

- [ ] **Step 2: Write the order actions (dev mark-paid + cancel)**

```ts
// app/(customer)/orders/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCustomerId } from "@/app/(customer)/_lib/customer";
import { markOrderPaid } from "@/lib/orders/payment";
import { assertTransition } from "@/lib/orders/state";

// DEV-ONLY stub: flip this order's payment to PAID. Ownership-scoped (the order
// must belong to the caller) AND disabled in production (Phase 4 replaces this
// with Stripe). Mirrors what the Stripe webhook will later do via markOrderPaid.
export async function devMarkPaid(orderId: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("dev mark-paid is disabled in production");
  }
  const customerId = await requireCustomerId();
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: { id: true },
  });
  if (!order) throw new Error("Order not found");

  await markOrderPaid(order.id);

  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/restaurant"); // the order now becomes visible in the queue
}

// Customer cancels their own order. Only legal while PLACED (state machine,
// actor CUSTOMER). Ownership-scoped; appends an event in one transaction.
export async function cancelOrder(orderId: string): Promise<void> {
  const customerId = await requireCustomerId();
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: { id: true, status: true },
  });
  if (!order) throw new Error("Order not found");

  assertTransition(order.status, "CANCELLED", "CUSTOMER"); // throws unless PLACED

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } }),
    prisma.orderStatusEvent.create({
      data: { orderId: order.id, from: order.status, to: "CANCELLED", byUserId: customerId },
    }),
  ]);

  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/orders");
}
```

- [ ] **Step 3: Write the polled status route**

```ts
// app/(customer)/orders/[id]/status/route.ts
// JSON the tracking page polls with SWR. Envelope { ok, data, error }. Owner-scoped:
// the order must belong to the caller (foreign/unknown id -> 404, no info leak).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCustomerId } from "@/app/(customer)/_lib/customer";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const customerId = await getCustomerId();
  if (!customerId) {
    return NextResponse.json({ ok: false, data: null, error: "Not authenticated" }, { status: 401 });
  }

  const order = await prisma.order.findFirst({
    where: { id, customerId },
    select: {
      status: true,
      payment: { select: { status: true } },
      events: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ ok: false, data: null, error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      status: order.status,
      paymentStatus: order.payment?.status ?? "PENDING",
      events: order.events.map((e) => ({ to: e.to, at: e.createdAt.toISOString() })),
    },
    error: null,
  });
}
```

- [ ] **Step 4: Write the dev mark-paid button (client)**

```tsx
// app/(customer)/orders/[id]/_components/mark-paid-button.tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { devMarkPaid } from "../actions";

// Dev-only: simulate a successful payment (Phase 4 replaces with Stripe). The
// page only renders this while payment is PENDING.
export function MarkPaidButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() => start(async () => { await devMarkPaid(orderId); })}
    >
      {pending ? "Processing…" : "Mark as paid (dev)"}
    </Button>
  );
}
```

- [ ] **Step 5: Write the tracking timeline (client, SWR poll)**

```tsx
// app/(customer)/orders/[id]/_components/order-tracker.tsx
"use client";

import useSWR from "swr";
import { isTerminal } from "@/lib/orders/state";
import { statusLabel } from "@/app/(customer)/_lib/format";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

interface StatusData {
  status: OrderStatus;
  paymentStatus: string;
  events: { to: OrderStatus; at: string }[];
}

const fetcher = async (url: string): Promise<StatusData> => {
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(body.error ?? "Failed to load status");
  return body.data as StatusData;
};

// Polls the status route every 5s (CLAUDE.md: polling, not push) and stops once
// the order is terminal. `initial` seeds the first paint (SWR fallback).
export function OrderTracker({ orderId, initial }: { orderId: string; initial: StatusData }) {
  const { data, error } = useSWR<StatusData>(`/orders/${orderId}/status`, fetcher, {
    fallbackData: initial,
    refreshInterval: (latest) => (latest && isTerminal(latest.status) ? 0 : 5000),
  });

  const view = data ?? initial;

  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        Couldn&apos;t load status. It will retry automatically.
      </p>
    );
  }

  return (
    <ol className="mt-4 space-y-2">
      {view.events.map((e, idx) => (
        <li key={idx} className="flex items-center gap-3 text-sm">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <span className="font-medium">{statusLabel(e.to)}</span>
        </li>
      ))}
      <li className="text-sm text-muted-foreground" data-testid="current-status">
        Current status: <span className="font-semibold">{statusLabel(view.status)}</span>
      </li>
    </ol>
  );
}
```

- [ ] **Step 6: Write the confirmation/tracking page**

```tsx
// app/(customer)/orders/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { getCustomerId } from "@/app/(customer)/_lib/customer";
import { formatCents, orderRef, statusLabel } from "@/app/(customer)/_lib/format";
import { isTerminal } from "@/lib/orders/state";
import { MarkPaidButton } from "./_components/mark-paid-button";
import { OrderTracker } from "./_components/order-tracker";
import { CancelOrderButton } from "./_components/cancel-order-button";

// Confirmation + live tracking ("/orders/[id]"). Owner-scoped (foreign/unknown
// id -> 404). Shows a dev "mark paid" button while PENDING, a cancel button
// while PLACED, the item summary, and a polling status timeline.
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = await getCustomerId();
  if (!customerId) notFound();

  const order = await prisma.order.findFirst({
    where: { id, customerId },
    select: {
      id: true,
      status: true,
      subtotalCents: true,
      deliveryFeeCents: true,
      totalCents: true,
      addressLine: true,
      restaurant: { select: { name: true } },
      items: { select: { name: true, priceCents: true, quantity: true } },
      payment: { select: { status: true } },
      events: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true } },
    },
  });
  if (!order) notFound();

  const isPending = (order.payment?.status ?? "PENDING") === "PENDING";

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/orders" className="text-sm text-muted-foreground underline">
        ← All orders
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Order {orderRef(order.id)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {order.restaurant.name} · {statusLabel(order.status)}
      </p>

      {isPending ? (
        <Card className="mt-6 border-primary/40">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <p className="text-sm">
              Payment pending. In production this is Stripe; for now, simulate it.
            </p>
            <MarkPaidButton orderId={order.id} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardContent className="space-y-1 p-5 text-sm">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {it.quantity} × {it.name}
              </span>
              <span>{formatCents(it.priceCents * it.quantity)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCents(order.subtotalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery fee</span>
            <span>{formatCents(order.deliveryFeeCents)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCents(order.totalCents)}</span>
          </div>
          <p className="pt-2 text-xs text-muted-foreground">Deliver to: {order.addressLine}</p>
        </CardContent>
      </Card>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tracking
        </h2>
        <OrderTracker
          orderId={order.id}
          initial={{
            status: order.status,
            paymentStatus: order.payment?.status ?? "PENDING",
            events: order.events.map((e) => ({ to: e.to, at: e.createdAt.toISOString() })),
          }}
        />
      </section>

      {order.status === "PLACED" ? (
        <div className="mt-6">
          <CancelOrderButton orderId={order.id} />
        </div>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 7: Write the cancel button (client)**

```tsx
// app/(customer)/orders/[id]/_components/cancel-order-button.tsx
"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelOrder } from "../actions";

// Cancel is only offered while PLACED (the page gates this). Confirms first.
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Cancel this order?")) {
          start(async () => { await cancelOrder(orderId); });
        }
      }}
    >
      {pending ? "Cancelling…" : "Cancel order"}
    </Button>
  );
}
```

- [ ] **Step 8: Verify in the browser**

As customer, place an order → on `/orders/[id]` see "Payment pending" + "Mark as paid (dev)". Click it → the pending card disappears, status timeline shows "Placed". In another tab, sign in as `owner@demo.test` → the order now appears in the restaurant **New** column (payment gate). Advance it Accept → Start preparing → Mark ready; back on the customer tab the timeline adds Accepted/Preparing/Ready within ~5s (polling). On a fresh PLACED (unpaid) order, "Cancel order" works and the status becomes Cancelled.

- [ ] **Step 9: Commit**

```bash
git add lib/orders/payment.ts "app/(customer)/orders/[id]"
git commit -m "feat(customer): stub-pay + tracking timeline + cancel (Phase 2)"
```

---

## Task 10: Order history (`/orders`)

**Files:**
- Create: `app/(customer)/orders/page.tsx`

- [ ] **Step 1: Write the history page**

```tsx
// app/(customer)/orders/page.tsx
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getCustomerId } from "@/app/(customer)/_lib/customer";
import { formatCents, orderRef, statusLabel } from "@/app/(customer)/_lib/format";

// Order history ("/orders") scoped to the logged-in customer (CLAUDE.md: a
// customer reads only their own orders).
export default async function OrdersPage() {
  const customerId = await getCustomerId();
  if (!customerId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Please sign in to see your orders.</p>
      </main>
    );
  }

  const orders = await prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      totalCents: true,
      createdAt: true,
      restaurant: { select: { name: true } },
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Your orders</h1>
      {orders.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No orders yet.{" "}
          <Link href="/browse" className="underline">
            Browse restaurants
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">
                      {o.restaurant.name} · {orderRef(o.id)}
                    </p>
                    <p className="text-sm text-muted-foreground">{statusLabel(o.status)}</p>
                  </div>
                  <span className="font-semibold">{formatCents(o.totalCents)}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Verify in the browser**

As customer, `/orders` lists orders you placed (most recent first), each linking to its tracking page. Sign in as a different user → your orders are not shown (scoped by `customerId`).

- [ ] **Step 3: Commit**

```bash
git add "app/(customer)/orders/page.tsx"
git commit -m "feat(customer): order history scoped to the customer (Phase 2)"
```

---

## Task 11: E2E — customer journey + negatives

**Files:**
- Create: `e2e/customer.spec.ts`

Covers the happy path end-to-end through the UI plus the key negatives. No fixed sleeps — wait on text/URLs. Uses the existing seed (`customer@demo.test`, `owner@demo.test`, Mario's Pizza). The test creates its own order, so it does not depend on seed order counts and is re-runnable.

- [ ] **Step 1: Write the E2E spec**

```ts
// e2e/customer.spec.ts
import { expect, test } from "@playwright/test";

// Customer demand side (Phase 2): discover -> cart -> checkout -> stub-pay ->
// the order becomes visible to the restaurant and advances on a live timeline.
// Plus negatives: ownership 404, cancel-before-accept, single-restaurant conflict.
//
// Seeded (password123): customer@demo.test (Maya), owner@demo.test (Mario's Pizza,
// APPROVED: Margherita $9.00, Pepperoni $11.00), owner2@demo.test (Spice Hub).
// PRECONDITION: pnpm prisma migrate dev && pnpm db:seed.
//
// NOT covered: real Stripe (Phase 4), driver claim/deliver (Phase 3),
// multi-address book (Phase 5).

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function addMargheritaToCart(page: import("@playwright/test").Page) {
  await page.goto("/browse");
  await page.getByRole("link", { name: "Mario's Pizza" }).click();
  await expect(page).toHaveURL(/\/restaurants\/.+/);
  // Add one Margherita (the first item's Add button).
  const row = page.locator("text=Margherita").locator("xpath=ancestor::*[self::div][1]");
  await page.getByRole("button", { name: "Add" }).first().click();
}

// Happy path: place + pay + see it advance.
test("customer places an order, pays (stub), and tracks it to READY", async ({ page }) => {
  await signIn(page, "customer@demo.test");
  await expect(page).toHaveURL("/browse");

  await addMargheritaToCart(page);

  await page.getByRole("link", { name: "Cart" }).click();
  await expect(page).toHaveURL("/cart");
  await expect(page.getByText("Total")).toBeVisible();

  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await expect(page).toHaveURL("/checkout");

  await page.getByLabel("Delivery address").fill("12 MG Road, Bengaluru");
  await page.getByRole("button", { name: "Place order" }).click();

  // Lands on the order tracking page, payment pending.
  await expect(page).toHaveURL(/\/orders\/.+/);
  const orderUrl = page.url();
  await expect(page.getByRole("button", { name: "Mark as paid (dev)" })).toBeVisible();

  // Pay (stub). Pending card disappears; status is Placed.
  await page.getByRole("button", { name: "Mark as paid (dev)" }).click();
  await expect(page.getByRole("button", { name: "Mark as paid (dev)" })).toHaveCount(0);
  await expect(page.getByTestId("current-status")).toContainText("Placed");

  // Restaurant now sees the paid order and advances it to READY.
  await signIn(page, "owner@demo.test");
  await expect(page).toHaveURL("/restaurant");
  const newColumn = page.locator("section", { hasText: "New" }).first();
  await newColumn.getByRole("link", { name: "Open" }).first().click();
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("button", { name: "Start preparing" }).click();
  await page.getByRole("button", { name: "Mark ready" }).click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();

  // Back on the customer's tracking page: the timeline reflects READY (polling).
  await signIn(page, "customer@demo.test");
  await page.goto(orderUrl);
  await expect(page.getByTestId("current-status")).toContainText("Ready", { timeout: 10_000 });
});

// Negative: a customer cannot open an order that isn't theirs (unknown id -> 404).
test("ownership: unknown order id renders not-found", async ({ page }) => {
  await signIn(page, "customer@demo.test");
  await page.goto("/orders/does-not-exist-id");
  await expect(page.getByText(/not found|404|This page could not be found/i)).toBeVisible();
});

// Negative: cancel is allowed only before acceptance (while PLACED).
test("customer can cancel an order while it is still PLACED", async ({ page }) => {
  await signIn(page, "customer@demo.test");
  await addMargheritaToCart(page);
  await page.goto("/checkout");
  await page.getByLabel("Delivery address").fill("9 Cancel Street, Bengaluru");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\/orders\/.+/);

  page.on("dialog", (d) => d.accept()); // confirm() -> OK
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(page.getByTestId("current-status")).toContainText("Cancelled");
});

// Negative: single-restaurant cart — adding from a second restaurant prompts to
// replace; declining keeps the original cart.
test("single-restaurant cart: declining the replace prompt keeps the first item", async ({
  page,
}) => {
  await signIn(page, "customer@demo.test");
  await addMargheritaToCart(page); // Mario's

  // Go to Spice Hub and try to add — decline the confirm.
  page.once("dialog", (d) => d.dismiss()); // confirm() -> Cancel
  await page.goto("/browse");
  await page.getByRole("link", { name: "Spice Hub" }).click();
  await page.getByRole("button", { name: "Add" }).first().click();

  // Cart still has 1 item (Mario's Margherita), not replaced.
  await page.getByRole("link", { name: "Cart" }).click();
  await expect(page.getByText("Mario's Pizza")).toBeVisible();
});
```

> **Implementer note:** the `row` locator in `addMargheritaToCart` is illustrative — if "Add" first() is ambiguous, target by the card containing "Margherita". Adjust selectors to the actual DOM during the green step; keep the queried button text "Add" stable.

- [ ] **Step 2: Reseed and run headed (visible Chromium — user rule)**

Run:
```bash
pnpm db:seed
pnpm exec playwright test e2e/customer.spec.ts --headed --reporter=list
```
Expected: 4 tests PASS. Fix selector/timing issues by waiting on text/URL (never `waitForTimeout`).

- [ ] **Step 3: Full no-regression gate (headed)**

Run:
```bash
pnpm db:seed
pnpm test              # Vitest: fees + cart + state machine
pnpm build             # production build clean
pnpm exec playwright test --headed --reporter=list   # ALL specs (auth, admin, restaurant, role-isolation, customer)
```
Expected: all green. The new customer flow must not break the 65 existing tests.

- [ ] **Step 4: Commit**

```bash
git add e2e/customer.spec.ts
git commit -m "test(e2e): customer journey + ownership/cancel/single-restaurant negatives (Phase 2)"
```

---

## Test cases doc (phase exit requirement)

Per the standing per-phase testing rule, before Phase 2 is "done" write `docs/superpowers/test-cases/2026-06-13-phase-2-test-cases.md` (matrix: positive/negative/edge across validation, business rules, permissions, error handling, API/route behavior, data integrity) and a companion execution report — mirroring the Phase 1 docs. Mark which cases are automated (Vitest/Playwright) vs schema/manual. This is documentation, committed separately:

```bash
git add docs/superpowers/test-cases/2026-06-13-phase-2-*.md
git commit -m "docs(test): Phase 2 test-case matrix + execution report"
```

---

## Self-Review

**1. Spec coverage (roadmap Phase 2):**
- Discovery (APPROVED grid, name search, cuisine filter) → Task 5. ✓
- Detail (APPROVED-gated `findFirst`, 404 no-leak, menu by category, available only) → Task 6. ✓
- Cart (pure immutable core + tests, context/localStorage, single-restaurant rule, add-to-cart conflict, cart page) → Tasks 2, 4, 5(button), 6(button), 7. ✓
- Customer scaffolding (`layout` with CartProvider, `requireCustomer`) → Tasks 3, 4. ✓
- Checkout (server re-validate live availability+price, reject foreign/cross-restaurant, snapshot prices, `deliveryFeeCents` from `fees.ts`, `total=subtotal+fee`, create Order+Items+Payment in one tx, single address) → Tasks 1, 8. ✓
- Stub payment seam (`markOrderPaid` idempotent; dev `<MarkPaidButton>` + `devMarkPaid`, NODE_ENV guard + ownership) → Task 9. ✓
- Tracking + history (`status` route polled JSON `{ok,data,error}`, stop at terminal; history scoped to `userId`; `cancelOrder` only PLACED via `assertTransition(...,'CUSTOMER')`) → Tasks 9, 10. ✓
- Exit acceptance (paid stub order reaches queue; restaurant advances to READY; timeline polls; ownership 404; cancel only before ACCEPTED) → Task 11 E2E. ✓

**2. Placeholder scan:** The only "illustrative" code is explicitly flagged with a corrected version inline (the checkout validation `.map` and the E2E `row` locator). No TBD/TODO. All other steps carry complete code.

**3. Type consistency:** `Cart`/`CartItem` shapes are consistent across `cart.ts`, `cart-context.tsx`, and consumers. `markOrderPaid(orderId): Promise<boolean>` used the same way in `devMarkPaid` (Phase 4 will reuse it). `assertTransition(from, to, "CUSTOMER")` matches the existing signature in `lib/orders/state.ts`. `formatCents`/`statusLabel`/`orderRef` signatures match the restaurant copy. `StatusData` in the route matches the tracker's interface (`status`, `paymentStatus`, `events[{to, at}]`).

**Risks flagged in the plan:** localStorage price drift (mitigated: server recompute from DB); partial order on an unavailable item (mitigated: validate-then-build, reject before create); double-submit (button disabled + `markOrderPaid` idempotent predicate); React 19 context syntax fallback noted; `AppHeader` change is additive (optional `children`); seed + auth.config left untouched to avoid cross-worktree merge conflicts.

**Out of scope (correctly deferred):** real Stripe (Phase 4), driver claim/deliver (Phase 3), multi-address book + saved addresses (Phase 5), `formatCents` consolidation into `lib/money.ts` (Phase 6).
