import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { prisma } from "@/lib/db";
import { getCustomerId } from "@/app/(customer)/_lib/customer";
import { formatCents, orderRef, statusLabel } from "@/app/(customer)/_lib/format";
import { PayButton } from "./_components/pay-button";
import { MarkPaidButton } from "./_components/mark-paid-button";
import { OrderTracker } from "./_components/order-tracker";
import { CancelOrderButton } from "./_components/cancel-order-button";
import { ClearCartOnMount } from "./_components/clear-cart-on-mount";

// Confirmation + live tracking ("/orders/[id]"). Owner-scoped (foreign/unknown
// id -> 404). Shows a dev "mark paid" button while PENDING, a cancel button
// while PLACED, the item summary, and a polling status timeline.
// When reached right after checkout (?placed=1), renders <ClearCartOnMount> so
// localStorage is cleared on the client.
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { id } = await params;
  const { placed } = await searchParams;
  const customerId = await getCustomerId();
  if (!customerId) notFound();

  const order = await prisma.order.findFirst({
    where: { id, customerId },
    select: {
      id: true,
      status: true,
      subtotalCents: true,
      deliveryFeeCents: true,
      totalCents: true,
      addressLine: true,
      restaurant: { select: { name: true } },
      items: { select: { name: true, priceCents: true, quantity: true } },
      payment: { select: { status: true } },
      events: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true } },
    },
  });
  if (!order) notFound();

  const isPending = (order.payment?.status ?? "PENDING") === "PENDING";

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      {placed === "1" ? <ClearCartOnMount /> : null}

      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← All orders
      </Link>

      <div className="mt-3 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Order {orderRef(order.id)}</h1>
        <StatusChip status={order.status} label={statusLabel(order.status)} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{order.restaurant.name}</p>

      {/* Payment pending card — shows both Stripe and dev buttons while PENDING.
          E2E: getByRole("button", { name: "Mark as paid (dev)" }) — text preserved. */}
      {isPending ? (
        <Card className="mt-6 border-warning/40 bg-warning-soft/40">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm text-foreground">
              Payment pending — complete your payment to confirm this order.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <PayButton orderId={order.id} />
              <MarkPaidButton orderId={order.id} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Order items + bill */}
      <Card className="mt-6">
        <CardContent className="space-y-1.5 p-5 text-sm">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-muted-foreground">
                {it.quantity} × {it.name}
              </span>
              <span className="tabular-nums">{formatCents(it.priceCents * it.quantity)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-border pt-2">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCents(order.subtotalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery fee</span>
            <span className="tabular-nums">{formatCents(order.deliveryFeeCents)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(order.totalCents)}</span>
          </div>
          <p className="pt-2 text-xs text-muted-foreground">
            Deliver to: {order.addressLine}
          </p>
        </CardContent>
      </Card>

      {/* Tracking timeline */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Tracking
        </h2>
        <OrderTracker
          orderId={order.id}
          initial={{
            status: order.status,
            paymentStatus: order.payment?.status ?? "PENDING",
            events: order.events.map((e) => ({ to: e.to, at: e.createdAt.toISOString() })),
          }}
        />
      </section>

      {/* Cancel — only while PLACED; E2E: getByRole("button", { name: "Cancel order" }) */}
      {order.status === "PLACED" ? (
        <div className="mt-6">
          <CancelOrderButton orderId={order.id} />
        </div>
      ) : null}
    </main>
  );
}
