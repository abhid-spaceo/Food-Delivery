"use client";
import { useEffect } from "react";
import { useCart } from "@/app/(customer)/_lib/cart-context";

// Clears the cart once, on the order-confirmation page reached right after
// checkout (?placed=1). Clearing an already-empty cart is harmless.
export function ClearCartOnMount() {
  const { clear } = useCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { clear(); }, []);
  return null;
}
