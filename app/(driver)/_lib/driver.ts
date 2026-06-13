// Driver scope helpers — the SECOND authorization layer for driver data. The
// proxy only checks the DRIVER role; only an APPROVED driver may claim/deliver,
// and a driver acts only on orders they claimed. Mirrors restaurant.ts.
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** The Driver row for the current session user, or null. Use in pages (e.g. to
 *  render an awaiting-approval screen for a PENDING driver). */
export async function getDriver() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return prisma.driver.findUnique({ where: { userId } });
}

/** Like getDriver but throws unless the driver exists AND is APPROVED. Use inside
 *  Server Actions that claim/deliver. Returns the driver + userId (for events). */
export async function requireApprovedDriver() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const driver = await prisma.driver.findUnique({ where: { userId } });
  if (!driver) throw new Error("No driver profile for this account");
  if (driver.status !== "APPROVED") throw new Error("Driver is not approved");

  return { driver, userId };
}
