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
