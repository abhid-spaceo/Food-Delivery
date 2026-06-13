"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Defense in depth (mirrors restaurants/actions.ts): re-verify ADMIN in the action.
async function assertAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden: admin role required.");
}

// Approve a driver (-> APPROVED, may now claim from the pool).
export async function approveDriver(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing driver id.");
  await prisma.driver.update({ where: { id }, data: { status: "APPROVED" } });
  revalidatePath("/admin/drivers");
}

// Suspend a driver (-> SUSPENDED, can no longer claim).
export async function suspendDriver(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing driver id.");
  await prisma.driver.update({ where: { id }, data: { status: "SUSPENDED" } });
  revalidatePath("/admin/drivers");
}
