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

      <div className="flex flex-col gap-4">
        {/* Route visualization card — pickup / drop dots with connecting line */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle>{order.restaurant.name}</CardTitle>
            {/* Raw enum Badge — E2E queries this text directly (OUT_FOR_DELIVERY / DELIVERED) */}
            <Badge value={order.status} />
          </CardHeader>
          <CardContent className="space-y-0 pb-4">
            {/* Route dot-and-line visualization */}
            <div className="relative space-y-0 pl-6">
              {/* Vertical connecting line between dots */}
              <div
                className="absolute left-[10px] top-[11px] w-0.5 bg-border"
                style={{ height: "calc(100% - 22px)" }}
                aria-hidden="true"
              />

              {/* Pickup row */}
              <div className="relative pb-4">
                <span
                  className="absolute left-[-16px] top-[3px] size-[13px] rounded-full border-[3px] border-[var(--brand-soft)] bg-primary"
                  aria-hidden="true"
                />
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Pickup
                </p>
                <p className="font-semibold text-foreground">{order.restaurant.name}</p>
              </div>

              {/* Drop row */}
              <div className="relative">
                <span
                  className="absolute left-[-16px] top-[3px] size-[13px] rounded-full border-[3px] border-[var(--success-soft)] bg-[var(--success)]"
                  aria-hidden="true"
                />
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Drop
                </p>
                <p className="font-semibold text-foreground">Customer</p>
                <p className="text-xs text-muted-foreground">{order.addressLine}</p>
              </div>
            </div>

            {/* Divider + fee highlight */}
            <div className="mt-4 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">You&apos;ll earn</span>
                <span className="text-base font-bold text-foreground">
                  {formatCents(order.deliveryFeeCents)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pb-4 text-sm">
            {order.items.map((it, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {it.name} × {it.quantity}
                </span>
                <span>{formatCents(it.priceCents * it.quantity)}</span>
              </div>
            ))}
            <div className="mt-2 border-t pt-2 font-semibold">
              Total {formatCents(order.totalCents)}
            </div>
          </CardContent>
        </Card>

        {/* Action */}
        <Card>
          <CardContent className="pt-6">
            {isClaimable ? (
              <div className="space-y-3">
                <ClaimButton orderId={order.id} />
                {/* Race-condition heads-up (visual only — informational note) */}
                <p className="rounded-lg border border-dashed border-primary bg-[var(--brand-soft)] p-3 text-xs text-[var(--brand-dark)]">
                  <strong>Heads up:</strong> first driver to claim gets the order. If
                  someone beats you, you&apos;ll be redirected to the pool.
                </p>
              </div>
            ) : isMineActive ? (
              <DeliverButton orderId={order.id} />
            ) : (
              /* E2E asserts this exact text — do not change */
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
