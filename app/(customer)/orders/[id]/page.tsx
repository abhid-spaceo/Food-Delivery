import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getCustomerId } from "@/app/(customer)/_lib/customer";
import { formatCents, orderRef, statusLabel } from "@/app/(customer)/_lib/format";
import { MarkPaidButton } from "./_components/mark-paid-button";
import { OrderTracker } from "./_components/order-tracker";
import { CancelOrderButton } from "./_components/cancel-order-button";

// Confirmation + live tracking ("/orders/[id]"). Owner-scoped (foreign/unknown
// id -> 404). Shows a dev "mark paid" button while PENDING, a cancel button
// while PLACED, the item summary, and a polling status timeline.
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      <Link href="/orders" className="text-sm text-muted-foreground underline">
        ← All orders
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Order {orderRef(order.id)}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {order.restaurant.name} · {statusLabel(order.status)}
      </p>

      {isPending ? (
        <Card className="mt-6 border-primary/40">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <p className="text-sm">
              Payment pending. In production this is Stripe; for now, simulate it.
            </p>
            <MarkPaidButton orderId={order.id} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardContent className="space-y-1 p-5 text-sm">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {it.quantity} × {it.name}
              </span>
              <span>{formatCents(it.priceCents * it.quantity)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-2">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCents(order.subtotalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery fee</span>
            <span>{formatCents(order.deliveryFeeCents)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCents(order.totalCents)}</span>
          </div>
          <p className="pt-2 text-xs text-muted-foreground">Deliver to: {order.addressLine}</p>
        </CardContent>
      </Card>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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

      {order.status === "PLACED" ? (
        <div className="mt-6">
          <CancelOrderButton orderId={order.id} />
        </div>
      ) : null}
    </main>
  );
}
