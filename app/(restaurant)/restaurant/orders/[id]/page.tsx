import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getOwnedRestaurant } from "@/app/(restaurant)/_lib/restaurant";
import { DashboardShell } from "@/app/(restaurant)/_components/dashboard-shell";
import { StatusBadge } from "@/app/(restaurant)/_components/status-badge";
import { OrderActions } from "@/app/(restaurant)/_components/order-actions";
import { formatCents, orderRef } from "@/app/(restaurant)/_lib/format";

// Order detail ("/restaurant/orders/[id]"). Items, totals, address, status, and
// status-conditional action buttons (WIREFRAMES S11). Ownership is enforced by
// scoping the query to the caller's own restaurant — a foreign order 404s.
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) notFound();

  const order = await prisma.order.findFirst({
    where: { id, restaurantId: restaurant.id }, // ownership scope
    include: {
      items: true,
      payment: true,
      customer: { select: { name: true, email: true } },
    },
  });
  if (!order) notFound();

  return (
    <DashboardShell title={`Order ${orderRef(order.id)}`}>
      <Link
        href="/restaurant"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to queue
      </Link>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Status</CardTitle>
            <StatusBadge status={order.status} />
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <span>
              Customer: {order.customer.name ?? order.customer.email}
            </span>
            <span>Placed: {order.createdAt.toLocaleString()}</span>
            <span>Payment: {order.payment?.status ?? "PENDING"}</span>
            <span>Deliver to: {order.addressLine}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.name} &times; {item.quantity}
                </span>
                {/* priceCents is the per-unit snapshot at purchase time */}
                <span>{formatCents(item.priceCents * item.quantity)}</span>
              </div>
            ))}
            <div className="mt-2 border-t pt-2 text-muted-foreground">
              Subtotal {formatCents(order.subtotalCents)} &middot; Fee{" "}
              {formatCents(order.deliveryFeeCents)}
            </div>
            <div className="font-semibold">Total {formatCents(order.totalCents)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderActions orderId={order.id} status={order.status} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
