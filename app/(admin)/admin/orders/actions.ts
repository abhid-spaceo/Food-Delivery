"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { markOrderPaid } from "@/lib/orders/payment";

// Defense in depth: the proxy already gates /admin to ADMIN, but every Server
// Action independently re-verifies the role (see CLAUDE.md / authorization.md).
async function assertAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Forbidden: admin role required.");
  }
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
