// app/(customer)/_components/cart-button.tsx
"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/app/(customer)/_lib/cart-context";
import { cartItemCount } from "@/app/(customer)/_lib/cart";

export function CartButton() {
  const { cart } = useCart();
  const count = cartItemCount(cart);
  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
      className="relative inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-card)]"
    >
      <ShoppingCart className="size-4 shrink-0" aria-hidden="true" />
      {/* "Cart" text must remain for the E2E getByRole("link", { name: "Cart" }) selector */}
      Cart
      {count > 0 ? (
        <span
          className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
