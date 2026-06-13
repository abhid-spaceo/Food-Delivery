import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getCustomerId } from "@/app/(customer)/_lib/customer";
import { formatCents, orderRef, statusLabel } from "@/app/(customer)/_lib/format";

// Order history ("/orders") scoped to the logged-in customer (CLAUDE.md: a
// customer reads only their own orders).
export default async function OrdersPage() {
  const customerId = await getCustomerId();
  if (!customerId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-muted-foreground">Please sign in to see your orders.</p>
      </main>
    );
  }

  const orders = await prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      totalCents: true,
      createdAt: true,
      restaurant: { select: { name: true } },
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Your orders</h1>
      {orders.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          No orders yet.{" "}
          <Link href="/browse" className="underline">
            Browse restaurants
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">
                      {o.restaurant.name} · {orderRef(o.id)}
                    </p>
                    <p className="text-sm text-muted-foreground">{statusLabel(o.status)}</p>
                  </div>
                  <span className="font-semibold">{formatCents(o.totalCents)}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
