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
          <Link href="/browse" className="text-primary underline underline-offset-2">
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
      {/* E2E never queries this text directly but it's important UX */}
      <p className="mt-1 text-sm text-muted-foreground">From {cart.restaurantName}</p>

      {/* Order summary card */}
      <Card className="mt-6">
        <CardContent className="p-5 text-sm space-y-1.5">
          {cart.items.map((it) => (
            <div key={it.menuItemId} className="flex justify-between">
              <span className="text-muted-foreground">
                {it.quantity} × {it.name}
              </span>
              <span className="tabular-nums">{formatCents(it.priceCents * it.quantity)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-2 mt-2">
            <span className="text-muted-foreground">Delivery fee</span>
            <span className="tabular-nums">{formatCents(FLAT_DELIVERY_FEE_CENTS)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(total)}</span>
          </div>
        </CardContent>
      </Card>

      <form action={action} className="mt-6 space-y-4">
        {/* Hidden inputs — E2E doesn't query these but the action needs them */}
        <input type="hidden" name="restaurantId" value={cart.restaurantId ?? ""} />
        <input type="hidden" name="lines" value={JSON.stringify(lines)} />

        <div className="space-y-2">
          {/* E2E: getByLabel("Delivery address") */}
          <Label htmlFor="addressLine" className="text-sm font-semibold">
            Delivery address
          </Label>
          <Input
            id="addressLine"
            name="addressLine"
            required
            placeholder="12 MG Road, Bengaluru"
            className="h-10"
          />
        </div>

        {state.error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        {/* E2E: getByRole("button", { name: "Place order" }) */}
        <Button
          type="submit"
          variant="gradient"
          disabled={pending}
          className="w-full h-11 text-base font-bold"
        >
          {pending ? "Placing order…" : "Place order"}
        </Button>
      </form>
    </main>
  );
}
