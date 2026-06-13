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
    expect(before.items).toHaveLength(0);
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
    expect(isDifferentRestaurant(EMPTY_CART, "r_spice")).toBe(false);
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
    let cart = addItem(EMPTY_CART, mario, margherita);
    cart = addItem(cart, mario, margherita);
    cart = addItem(cart, mario, pepperoni);
    expect(cartSubtotalCents(cart)).toBe(1800 + 1100);
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
