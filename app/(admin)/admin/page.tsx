import Link from "next/link";
import { prisma } from "@/lib/db";
import { StatCard } from "@/app/(admin)/_components/stat-card";
import { Badge } from "@/app/(admin)/_components/badge";
import { formatCents } from "@/app/(admin)/_components/money";
import { Table, THead, TBody, TR, TH, TD } from "@/app/(admin)/_components/table";

// Admin Overview ("/admin", S14). KPI cards + recent orders, all read from the
// DB as a Server Component. "Test revenue" = sum of totalCents across PAID orders.
export default async function AdminOverviewPage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalRestaurants,
    pendingApprovals,
    totalOrders,
    ordersToday,
    paidAgg,
    recentOrders,
  ] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { status: "PENDING" } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    // Revenue: sum totalCents of orders whose Payment is PAID.
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { payment: { status: "PAID" } },
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { restaurant: { select: { name: true } } },
    }),
  ]);

  const revenueCents = paidAgg._sum.totalCents ?? 0;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Platform overview</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Restaurants" value={totalRestaurants} />
        <StatCard label="Pending approvals" value={pendingApprovals} />
        <StatCard label="Total orders" value={totalOrders} />
        <StatCard label="Orders today" value={ordersToday} />
        <StatCard label="Test revenue (paid)" value={formatCents(revenueCents)} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent orders</h2>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Order</TH>
                <TH>Restaurant</TH>
                <TH>Status</TH>
                <TH className="text-right">Total</TH>
              </TR>
            </THead>
            <TBody>
              {recentOrders.map((order) => (
                <TR key={order.id}>
                  <TD className="font-mono text-xs">
                    <Link href={`/admin/orders?id=${order.id}`} className="hover:underline">
                      {order.id.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD>{order.restaurant.name}</TD>
                  <TD>
                    <Badge value={order.status} />
                  </TD>
                  <TD className="text-right tabular-nums">{formatCents(order.totalCents)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
