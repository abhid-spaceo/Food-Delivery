"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markOrderPaid } from "@/lib/orders/payment";
import { assertTransition } from "@/lib/orders/state";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

// Defense in depth: the proxy already gates /admin to ADMIN, but every Server
// Action independently re-verifies the role (see CLAUDE.md / authorization.md).
async function assertAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Forbidden: admin role required.");
  }
  // Return the admin's userId for audit events.
  return session!.user!.id as string;
}

// Fallback for orders stuck with a PENDING payment (e.g. webhook missed).
// PRD §7.13 — admin can manually unblock any order.
export async function adminMarkPaid(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing order id.");

  await markOrderPaid(id);
  revalidatePath("/admin/orders");
}

// Force-cancel any non-terminal order regardless of who owns it. The state
// machine enforces that only ADMIN can fire ACCEPTED/PREPARING/READY/
// OUT_FOR_DELIVERY -> CANCELLED; terminal orders throw IllegalTransitionError.
// We also null the driverId to release the driver from a claimed order.
export async function forceCancelOrder(formData: FormData) {
  const adminId = await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing order id.");

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!order) throw new Error("Order not found.");

  const from = order.status as OrderStatus;
  assertTransition(from, "CANCELLED", "ADMIN"); // throws if terminal

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", driverId: null },
    }),
    prisma.orderStatusEvent.create({
      data: { orderId: order.id, from, to: "CANCELLED", byUserId: adminId },
    }),
  ]);

  revalidatePath("/admin/orders");
}

// Reassign an OUT_FOR_DELIVERY order to a different APPROVED driver.
// This is NOT a status change — it only swaps the driverId. We write an
// OrderStatusEvent with from=to=OUT_FOR_DELIVERY as an audit record.
export async function reassignDriver(formData: FormData) {
  const adminId = await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const newDriverId = String(formData.get("newDriverId") ?? "");
  if (!id) throw new Error("Missing order id.");
  if (!newDriverId) throw new Error("Missing newDriverId.");

  // Verify the target driver exists and is APPROVED.
  const driver = await prisma.driver.findUnique({
    where: { id: newDriverId },
    select: { id: true, status: true },
  });
  if (!driver || driver.status !== "APPROVED") {
    throw new Error("Driver not found or not APPROVED.");
  }

  // Scope the update to OUT_FOR_DELIVERY orders only — foreign or wrong-status
  // id matches zero rows (safe no-op) rather than mutating unintended records.
  const result = await prisma.order.updateMany({
    where: { id, status: "OUT_FOR_DELIVERY" },
    data: { driverId: newDriverId },
  });
  if (result.count === 0) {
    throw new Error("Order not found or not OUT_FOR_DELIVERY.");
  }

  // Append audit event: from=to=OUT_FOR_DELIVERY to signal a driver swap, not
  // a status change. byUserId is the admin who performed the reassignment.
  await prisma.orderStatusEvent.create({
    data: {
      orderId: id,
      from: "OUT_FOR_DELIVERY",
      to: "OUT_FOR_DELIVERY",
      byUserId: adminId,
    },
  });

  revalidatePath("/admin/orders");
}
