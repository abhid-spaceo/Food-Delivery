// app/(customer)/_lib/customer.ts
// Customer scope helpers — the SECOND authorization layer for customer data.
// The proxy only checks that SOMEONE is logged in for /cart /checkout /orders;
// every action/page that reads or mutates an order MUST scope to this userId.
import { auth } from "@/lib/auth";

/** Current customer's userId, or null when there is no session. Use in pages. */
export async function getCustomerId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Like getCustomerId but throws when unauthenticated. Use inside Server Actions. */
export async function requireCustomerId(): Promise<string> {
  const id = await getCustomerId();
  if (!id) throw new Error("Not authenticated");
  return id;
}
