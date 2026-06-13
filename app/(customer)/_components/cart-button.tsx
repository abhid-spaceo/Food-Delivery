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
