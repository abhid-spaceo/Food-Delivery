// app/(customer)/layout.tsx
// Wraps every customer route in the cart provider so the cart (localStorage)
// is shared across browse, detail, cart, and checkout.
import { CartProvider } from "./_lib/cart-context";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
