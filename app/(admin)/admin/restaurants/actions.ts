"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Defense in depth: the proxy already gates /admin to ADMIN, but every Server
// Action independently re-verifies the role before mutating (see CLAUDE.md).
async function assertAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Forbidden: admin role required.");
  }
}

// Approve a restaurant (-> APPROVED, now visible to customers).
export async function approveRestaurant(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing restaurant id.");

  await prisma.restaurant.update({
    where: { id },
    data: { status: "APPROVED" },
  });
  revalidatePath("/admin/restaurants");
}

// Suspend a restaurant (-> SUSPENDED, hidden from customers).
export async function suspendRestaurant(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing restaurant id.");

  await prisma.restaurant.update({
    where: { id },
    data: { status: "SUSPENDED" },
  });
  revalidatePath("/admin/restaurants");
}
