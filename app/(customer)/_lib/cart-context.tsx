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

  // Load from localStorage once on mount (client only). setState in this effect is
  // intentional and correct: localStorage isn't available during SSR, so reading it
  // in a useState initializer would cause a hydration mismatch. The canonical
  // hydrate-from-storage pattern is to start empty and reconcile post-mount.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- see comment above */
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCart(JSON.parse(raw) as Cart);
    } catch {
      // ignore malformed storage — start with an empty cart
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
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

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}
