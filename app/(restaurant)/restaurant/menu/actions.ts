"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant } from "@/app/(restaurant)/_lib/restaurant";

// Menu CRUD for THIS owner only. EVERY action resolves the caller's own
// restaurant first, then scopes/validates writes to it — a foreign category or
// item id can never be touched. Prices are integer cents (CLAUDE.md), validated
// here at the boundary. Returns void; pages revalidate to re-render.

const nameSchema = z.string().trim().min(1, "Name is required").max(120);

// ---- Categories ----

export async function createCategory(formData: FormData) {
  const { restaurant } = await requireOwnedRestaurant();
  const name = nameSchema.parse(formData.get("name"));

  await prisma.menuCategory.create({
    data: { restaurantId: restaurant.id, name },
  });
  revalidatePath("/restaurant/menu");
}

export async function renameCategory(formData: FormData) {
  const { restaurant } = await requireOwnedRestaurant();
  const id = z.string().min(1).parse(formData.get("id"));
  const name = nameSchema.parse(formData.get("name"));

  // Scope the update to the owner's restaurant so a foreign id is a no-op.
  await prisma.menuCategory.updateMany({
    where: { id, restaurantId: restaurant.id },
    data: { name },
  });
  revalidatePath("/restaurant/menu");
}

export async function deleteCategory(formData: FormData) {
  const { restaurant } = await requireOwnedRestaurant();
  const id = z.string().min(1).parse(formData.get("id"));

  await prisma.menuCategory.deleteMany({
    where: { id, restaurantId: restaurant.id },
  });
  revalidatePath("/restaurant/menu");
}

// ---- Items ----

const itemSchema = z.object({
  name: nameSchema,
  description: z.string().trim().max(500).optional(),
  // priceCents is an integer count of cents (e.g. 900 = $9.00). No floats.
  priceCents: z.coerce.number().int("Price must be whole cents").min(0).max(1_000_000),
  imageUrl: z.union([z.url(), z.literal("")]).optional(),
  isAvailable: z.boolean(),
});

/** Confirm a category belongs to the caller's restaurant before writing items. */
async function assertOwnsCategory(categoryId: string, restaurantId: string) {
  const category = await prisma.menuCategory.findFirst({
    where: { id: categoryId, restaurantId },
    select: { id: true },
  });
  if (!category) throw new Error("Category not found");
}

export async function createItem(formData: FormData) {
  const { restaurant } = await requireOwnedRestaurant();
  const categoryId = z.string().min(1).parse(formData.get("categoryId"));
  await assertOwnsCategory(categoryId, restaurant.id);

  const data = itemSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    priceCents: formData.get("priceCents"),
    imageUrl: formData.get("imageUrl") || undefined,
    isAvailable: formData.get("isAvailable") === "on",
  });

  await prisma.menuItem.create({
    data: {
      categoryId,
      name: data.name,
      description: data.description ?? null,
      priceCents: data.priceCents,
      imageUrl: data.imageUrl ? data.imageUrl : null,
      isAvailable: data.isAvailable,
    },
  });
  revalidatePath("/restaurant/menu");
}

export async function updateItem(formData: FormData) {
  const { restaurant } = await requireOwnedRestaurant();
  const id = z.string().min(1).parse(formData.get("id"));

  // Re-check ownership through the category->restaurant chain.
  const existing = await prisma.menuItem.findFirst({
    where: { id, category: { restaurantId: restaurant.id } },
    select: { id: true },
  });
  if (!existing) throw new Error("Item not found");

  const data = itemSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    priceCents: formData.get("priceCents"),
    imageUrl: formData.get("imageUrl") || undefined,
    isAvailable: formData.get("isAvailable") === "on",
  });

  await prisma.menuItem.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description ?? null,
      priceCents: data.priceCents,
      imageUrl: data.imageUrl ? data.imageUrl : null,
      isAvailable: data.isAvailable,
    },
  });
  revalidatePath("/restaurant/menu");
}

export async function deleteItem(formData: FormData) {
  const { restaurant } = await requireOwnedRestaurant();
  const id = z.string().min(1).parse(formData.get("id"));

  // deleteMany scoped through the category chain so a foreign id is a no-op.
  await prisma.menuItem.deleteMany({
    where: { id, category: { restaurantId: restaurant.id } },
  });
  revalidatePath("/restaurant/menu");
}

/** Quick toggle from the menu list (a tiny one-field form per row). */
export async function toggleItemAvailability(formData: FormData) {
  const { restaurant } = await requireOwnedRestaurant();
  const id = z.string().min(1).parse(formData.get("id"));
  const next = formData.get("isAvailable") === "true";

  await prisma.menuItem.updateMany({
    where: { id, category: { restaurantId: restaurant.id } },
    data: { isAvailable: next },
  });
  revalidatePath("/restaurant/menu");
}
