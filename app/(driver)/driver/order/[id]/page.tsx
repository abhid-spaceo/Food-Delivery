import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { Badge } from "@/app/(admin)/_components/badge";
import { formatCents, orderRef } from "@/app/(restaurant)/_lib/format";
import { ClaimButton } from "./_components/claim-button";
import { DeliverButton } from "./_components/deliver-button";

// Driver order detail ("/driver/order/[id]"). APPROVED drivers only. Offers:
//   - Claim, if the order is still a claimable pool order (READY, unclaimed, PAID)
//   - Mark delivered, if THIS driver already claimed it (OUT_FOR_DELIVERY, driverId=me)
//   - otherwise: not actionable (claimed by someone else / already delivered).
export default async function DriverOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") redirect("/driver");

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      driverId: true,
      totalCents: true,
      subtotalCents: true,
      deliveryFeeCents: true,
      addressLine: true,
      restaurant: { select: { name: true } },
      items: { select: { name: true, quantity: true, priceCents: true } },
      payment: { select: { status: true } },
    },
  });
  if (!order) notFound();

  const isClaimable =
    order.status === "READY" &&
    order.driverId === null &&
    order.payment?.status === "PAID";
  const isMineActive = order.driverId === driver.id && order.status === "OUT_FOR_DELIVERY";

  return (
    <DriverShell title={`Order ${orderRef(order.id)}`}>
      <Link
        href="/driver/pool"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to pool
      </Link>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{order.restaurant.name}</CardTitle>
            <Badge value={order.status} />
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <span>Deliver to: {order.addressLine}</span>
            <span>Earn: {formatCents(order.deliveryFeeCents)}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {order.items.map((it, i) => (
              <div key={i} className="flex justify-between">
                <span>{it.name} × {it.quantity}</span>
                <span>{formatCents(it.priceCents * it.quantity)}</span>
              </div>
            ))}
            <div className="mt-2 border-t pt-2 font-semibold">
              Total {formatCents(order.totalCents)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Action</CardTitle>
          </CardHeader>
          <CardContent>
            {isClaimable ? (
              <ClaimButton orderId={order.id} />
            ) : isMineActive ? (
              <DeliverButton orderId={order.id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                This order isn&apos;t available to you.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DriverShell>
  );
}
