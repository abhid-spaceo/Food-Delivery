import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, MapPin, CreditCard, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { Timeline } from "@/components/ui/timeline";
import type { TimelineStep } from "@/components/ui/timeline";
import { prisma } from "@/lib/db";
import { getOwnedRestaurant } from "@/app/(restaurant)/_lib/restaurant";
import { DashboardShell } from "@/app/(restaurant)/_components/dashboard-shell";
import { StatusBadge } from "@/app/(restaurant)/_components/status-badge";
import { OrderActions } from "@/app/(restaurant)/_components/order-actions";
import { formatCents, orderRef, statusLabel } from "@/app/(restaurant)/_lib/format";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

// Ordered list of order statuses for the timeline track.
const STATUS_TRACK: OrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

// Build timeline steps from the canonical track + the actual events logged.
// Terminal statuses REJECTED / CANCELLED replace the track with a single step.
function buildTimelineSteps(
  currentStatus: OrderStatus,
  events: Array<{ to: OrderStatus; createdAt: Date }>,
): TimelineStep[] {
  if (currentStatus === "REJECTED" || currentStatus === "CANCELLED") {
    return [
      {
        label: statusLabel(currentStatus),
        description: events.at(-1)?.createdAt.toLocaleString(),
        state: "done",
      },
    ];
  }

  const currentIdx = STATUS_TRACK.indexOf(currentStatus);
  return STATUS_TRACK.map((s, i) => {
    const event = events.find((e) => e.to === s);
    if (i < currentIdx) {
      return { label: statusLabel(s), description: event?.createdAt.toLocaleString(), state: "done" as const };
    }
    if (i === currentIdx) {
      return { label: statusLabel(s), description: event?.createdAt.toLocaleString(), state: "current" as const };
    }
    return { label: statusLabel(s), state: "pending" as const };
  });
}

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
      events: { orderBy: { createdAt: "asc" } },
    },
    // prepMinutes is included via the default include (all scalar fields)
  });
  if (!order) notFound();

  const timelineSteps = buildTimelineSteps(order.status, order.events);

  return (
    <DashboardShell title={`Order ${orderRef(order.id)}`}>
      <Link
        href="/restaurant"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to queue
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
        {/* Left column */}
        <div className="flex flex-col gap-6">
          {/* Customer & order info */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle>Order details</CardTitle>
              <span data-testid="order-status">
                <StatusBadge status={order.status} />
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="size-4 shrink-0 text-muted-foreground" />
                <span>{order.customer.name ?? order.customer.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-4 shrink-0 text-muted-foreground" />
                <span>Placed {order.createdAt.toLocaleString()}</span>
              </div>
              {order.prepMinutes != null && (
                <div className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0 text-muted-foreground" />
                  <span>~{order.prepMinutes} min prep time</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                <StatusChip status={order.payment?.status ?? "PENDING"} />
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                <span>{order.addressLine}</span>
              </div>
            </CardContent>
          </Card>

          {/* Items + totals */}
          <Card>
            <CardHeader className="pb-3">
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

          {/* Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderActions orderId={order.id} status={order.status} />
            </CardContent>
          </Card>
        </div>

        {/* Right column — status timeline */}
        <div className="w-full lg:w-52">
          <Card className="sticky top-[4.5rem]">
            <CardHeader className="pb-3">
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline steps={timelineSteps} />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
