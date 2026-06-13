// app/(customer)/cart/page.tsx
"use client";

import Link from "next/link";
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
