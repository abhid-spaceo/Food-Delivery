// app/(customer)/_components/add-to-cart-button.tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCart } from "@/app/(customer)/_lib/cart-context";

interface Props {
  restaurant: { id: string; name: string };
  item: { menuItemId: string; name: string; priceCents: number };
}

// Adds one item to the cart. If the cart holds a different restaurant, confirms
// before replacing (single-restaurant rule, CLAUDE.md). `window.confirm` is the
// MVP UX; a styled dialog is a later polish.
export function AddToCartButton({ restaurant, item }: Props) {
  const { add } = useCart();
  const router = useRouter();

  function onAdd() {
    const added = add(restaurant, item, () =>
      window.confirm(
        "Your cart has items from another restaurant. Replace it with this item?",
      ),
    );
    if (added) router.refresh();
  }

  return (
    <Button size="sm" variant="outline" onClick={onAdd}>
      Add
    </Button>
  );
}
