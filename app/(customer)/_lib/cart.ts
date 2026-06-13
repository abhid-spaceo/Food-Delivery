// Pure, immutable cart model. No React, no storage — the provider (cart-context)
// wraps these with localStorage. One order = one restaurant (CLAUDE.md), so the
// cart stamps the restaurant on first add and clears it when emptied. Money is
// integer cents throughout.

export interface CartItem {
  menuItemId: string;
  name: string;
  priceCents: number;
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
