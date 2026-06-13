// Restaurant ownership helpers — the SECOND authorization layer.
// The proxy (auth.config `authorized`) only checks the RESTAURANT role; every
// Server Action and page that touches restaurant data MUST independently resolve
// the caller's OWN restaurant via these helpers and never trust the route guard.
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Resolve the restaurant owned by the current session user, or null when there
 * is no session / no restaurant. Use in pages to render an onboarding message.
 */
export async function getOwnedRestaurant() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.restaurant.findUnique({ where: { ownerId: userId } });
}

/**
 * Like getOwnedRestaurant but throws when there is no session or no restaurant.
 * Use inside Server Actions: it guarantees the returned restaurant belongs to
 * the caller, so any later `where: { restaurantId: restaurant.id }` is safe.
 * Returns the userId too, for OrderStatusEvent.byUserId.
 */
export async function requireOwnedRestaurant() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const restaurant = await prisma.restaurant.findUnique({ where: { ownerId: userId } });
  if (!restaurant) throw new Error("No restaurant for this account");

  return { restaurant, userId };
}
