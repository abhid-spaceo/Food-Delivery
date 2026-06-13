"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireApprovedDriver } from "@/app/(driver)/_lib/driver";

// Toggle the driver's online/offline status.
// Re-checks that the driver is APPROVED (second authz layer) before writing.
export async function setDriverOnline(online: boolean): Promise<void> {
  const { driver } = await requireApprovedDriver();

  await prisma.driver.update({
    where: { id: driver.id },
    data: { isOnline: online },
  });
  revalidatePath("/driver");
  revalidatePath("/driver/pool");
}
