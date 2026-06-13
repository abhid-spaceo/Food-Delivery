"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant } from "@/app/(restaurant)/_lib/restaurant";

// Toggle accepting-orders state for the caller's own restaurant.
// Re-checks ownership (second authz layer) before writing.
export async function toggleAcceptingOrders(formData: FormData) {
  const { restaurant } = await requireOwnedRestaurant();
  const next = formData.get("isAcceptingOrders") === "true";

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { isAcceptingOrders: next },
  });
  revalidatePath("/restaurant/profile");
}

// Edit the caller's OWN restaurant profile. Resolves the owned restaurant first
// (second authz layer), then updates by its id. `status` is NOT editable here —
// approval is an admin-only action (CLAUDE.md visibility rule).
const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  cuisine: z.string().trim().min(1, "Cuisine is required").max(80),
  hours: z.string().trim().max(120).optional(),
  deliveryArea: z.string().trim().max(160).optional(),
});

export async function updateProfile(formData: FormData) {
  const { restaurant } = await requireOwnedRestaurant();

  const data = profileSchema.parse({
    name: formData.get("name"),
    cuisine: formData.get("cuisine"),
    hours: formData.get("hours") || undefined,
    deliveryArea: formData.get("deliveryArea") || undefined,
  });

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      name: data.name,
      cuisine: data.cuisine,
      hours: data.hours ?? null,
      deliveryArea: data.deliveryArea ?? null,
    },
  });
  revalidatePath("/restaurant/profile");
}
