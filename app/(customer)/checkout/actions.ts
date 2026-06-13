"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCustomerId } from "@/app/(customer)/_lib/customer";
import { FLAT_DELIVERY_FEE_CENTS } from "@/lib/orders/fees";

// Shape submitted from the client cart (hidden JSON field). The server trusts
// ONLY the ids + quantities; names and prices are re-read from the DB.
interface SubmittedLine {
  menuItemId: string;
  quantity: number;
}

export interface CheckoutState {
  error?: string;
}

// Create a PLACED order from the cart. SECOND authz layer + all business rules:
//   - require a logged-in customer (scope the order to them)
//   - re-validate every line against the live menu: item exists, is available,
//     belongs to the SAME approved restaurant (reject cross-restaurant / foreign)
//   - snapshot name + priceCents from the DB (never the client) — price snapshot rule
//   - money in integer cents: subtotal = Σ price*qty, total = subtotal + fee
//   - create Order + items + Payment(PENDING) + initial event in ONE transaction
// Payment stays PENDING until markOrderPaid (stub now, Stripe in Phase 4), so the
// order is invisible to the restaurant queue until "paid".
export async function placeOrder(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const customerId = await requireCustomerId();

  const addressLine = String(formData.get("addressLine") ?? "").trim();
  if (!addressLine) return { error: "Please enter a delivery address." };

  const restaurantId = String(formData.get("restaurantId") ?? "");
  let lines: SubmittedLine[];
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Your cart could not be read. Please try again." };
  }
  if (!restaurantId || lines.length === 0) {
    return { error: "Your cart is empty." };
  }

  // Restaurant must be APPROVED (visibility rule) and accepting orders.
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: restaurantId, status: "APPROVED" },
    select: { id: true, isAcceptingOrders: true },
  });
  if (!restaurant) return { error: "This restaurant is no longer available." };
  if (!restaurant.isAcceptingOrders) {
    return { error: "This restaurant is not accepting orders right now." };
  }

  // Re-read each item from the DB; reject anything missing, unavailable, or not
  // belonging to this restaurant (foreign/cross-restaurant ids match nothing).
  const ids = lines.map((l) => l.menuItemId);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids }, isAvailable: true, category: { restaurantId } },
    select: { id: true, name: true, priceCents: true },
  });
  const byId = new Map(items.map((i) => [i.id, i]));

  // Validate first, then build — the corrected version from the Implementer note.
  const missing = lines.find((l) => !byId.has(l.menuItemId));
  if (missing) return { error: "An item in your cart is no longer available. Please review your cart." };
  const snapshot = lines.map((l) => {
    const item = byId.get(l.menuItemId)!;
    return { name: item.name, priceCents: item.priceCents, quantity: Math.max(1, Math.floor(l.quantity)) };
  });

  const subtotalCents = snapshot.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
  const deliveryFeeCents = FLAT_DELIVERY_FEE_CENTS;
  const totalCents = subtotalCents + deliveryFeeCents;

  const order = await prisma.order.create({
    data: {
      customerId,
      restaurantId,
      status: "PLACED",
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      addressLine,
      items: { create: snapshot },
      payment: { create: { status: "PENDING" } },
      events: { create: [{ from: null, to: "PLACED", byUserId: customerId }] },
    },
    select: { id: true },
  });

  revalidatePath("/orders");
  redirect(`/orders/${order.id}?placed=1`);
}
