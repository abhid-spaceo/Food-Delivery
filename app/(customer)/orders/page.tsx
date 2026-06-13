import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
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
        <EmptyState
          icon="📦"
          title="No orders yet"
          description="Place your first order and it will appear here."
          action={
            <Button asChild variant="gradient" size="sm">
              <Link href="/browse">Browse restaurants</Link>
            </Button>
          }
          className="mt-6"
        />
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {orders.map((o) => (
            // E2E: getByRole("link") on order cards — the link wraps the card
            <Link key={o.id} href={`/orders/${o.id}`} className="block group">
              <Card elevated className="transition-colors group-hover:border-primary/30">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {o.restaurant.name} · {orderRef(o.id)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {/* StatusChip uses the status→variant mapping from status-chip.tsx */}
                      <StatusChip status={o.status} label={statusLabel(o.status)} />
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatCents(o.totalCents)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
