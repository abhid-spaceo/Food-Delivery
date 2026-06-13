// app/(customer)/cart/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
    <div className="min-h-screen bg-background">
      {/* Plain header — AppHeader is async Server Component, can't use here */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-card/85 px-6 py-3 backdrop-blur-md">
        <Link href="/browse" className="flex items-center gap-2 font-black tracking-tight text-foreground">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-xl text-sm font-black text-white shadow-[0_4px_10px_rgba(255,46,84,0.35)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            QB
          </span>
          QwikBite
        </Link>
        <span className="text-sm font-semibold text-muted-foreground">Your cart</span>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Your cart</h1>

        {empty ? (
          <EmptyState
            icon="🛒"
            title="Your cart is empty"
            description="Add items from a restaurant to get started."
            action={
              <Button asChild variant="gradient" size="sm">
                <Link href="/browse">Browse restaurants</Link>
              </Button>
            }
            className="mt-8"
          />
        ) : (
          <>
            {/* E2E: page.getByText("Mario's Pizza") via cart.restaurantName */}
            <p className="mt-1 text-sm text-muted-foreground">From {cart.restaurantName}</p>

            <div className="mt-6 flex flex-col gap-3">
              {cart.items.map((it) => (
                <Card key={it.menuItemId} className="overflow-hidden">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{it.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCents(it.priceCents)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Decrease ${it.name}`}
                        onClick={() => setQty(it.menuItemId, it.quantity - 1)}
                        className="size-8 rounded-full p-0 text-base font-bold"
                      >
                        −
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">
                        {it.quantity}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Increase ${it.name}`}
                        onClick={() => setQty(it.menuItemId, it.quantity + 1)}
                        className="size-8 rounded-full p-0 text-base font-bold"
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(it.menuItemId)}
                        className="ml-1 text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Bill breakdown */}
            <Card className="mt-6">
              <CardContent className="p-5 space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCents(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery fee</span>
                  <span className="tabular-nums">{formatCents(FLAT_DELIVERY_FEE_CENTS)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  {/* E2E: getByText("Total", { exact: true }) */}
                  <span>Total</span>
                  <span className="tabular-nums">{formatCents(total)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Gradient CTA — E2E: getByRole("link", { name: "Proceed to checkout" }) */}
            <Button asChild variant="gradient" className="mt-6 w-full h-11 text-base font-bold">
              <Link href="/checkout">Proceed to checkout</Link>
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
