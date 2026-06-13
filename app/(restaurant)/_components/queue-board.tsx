"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/app/(restaurant)/_components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCents, orderRef } from "@/app/(restaurant)/_lib/format";
import type { QueueData, QueueOrder } from "@/app/(restaurant)/_lib/queue";

// Three-column queue board (New / In progress / Completed). Polls the JSON
// endpoint every 5s with SWR so newly-paid or advanced orders appear without a
// reload (CLAUDE.md: polling, not push). `initial` is the server-rendered
// snapshot used as SWR fallback so the first paint isn't empty.
const fetcher = async (url: string): Promise<QueueData> => {
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(body.error ?? "Failed to load queue");
  return body.data as QueueData;
};

function OrderCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-1 h-8 w-16 rounded-full" />
      </CardContent>
    </Card>
  );
}

function OrderCard({ order, cta }: { order: QueueOrder; cta: string }) {
  // All orders surfaced here are PAID (getQueue filters by payment.status=PAID).
  return (
    <Card elevated>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{orderRef(order.id)}</span>
          <StatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
          </span>
          {/* PAID chip: all queue orders are payment-gated, so this is always accurate */}
          <Badge variant="success">PAID</Badge>
        </div>
        <span className="text-sm font-semibold">{formatCents(order.totalCents)}</span>
        <Button asChild variant="outline" size="sm" className="mt-1 self-start">
          <Link href={`/restaurant/orders/${order.id}`}>{cta}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// Column count chip variant by column position
const COUNT_VARIANT: Record<string, "brand" | "warning" | "info" | "gray"> = {
  New: "brand",
  "Ready · awaiting driver": "info",
  "In progress": "warning",
  Completed: "gray",
};

function Column({
  title,
  orders,
  cta,
  emptyText,
}: {
  title: string;
  orders: QueueOrder[];
  cta: string;
  emptyText: string;
}) {
  const countVariant = COUNT_VARIANT[title] ?? "gray";
  return (
    <section className="min-w-0 flex-1">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <Badge variant={countVariant}>{orders.length}</Badge>
      </div>
      <div className="flex flex-col gap-3">
        {orders.length === 0 ? (
          <EmptyState
            title={emptyText}
            className="border-dashed py-6 text-xs"
          />
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} cta={cta} />)
        )}
      </div>
    </section>
  );
}

export function QueueBoard({ initial }: { initial: QueueData }) {
  const { data, error, isLoading } = useSWR<QueueData>("/restaurant/orders/queue", fetcher, {
    fallbackData: initial,
    refreshInterval: 5000,
  });

  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Couldn&apos;t load the queue. It will retry automatically.
      </p>
    );
  }

  // Show skeletons on initial load only (fallbackData means isLoading is rarely true)
  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-6 md:flex-row">
        {[1, 2, 3, 4].map((i) => (
          <section key={i} className="min-w-0 flex-1">
            <div className="mb-3 flex items-center justify-between gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
            <div className="flex flex-col gap-3">
              <OrderCardSkeleton />
            </div>
          </section>
        ))}
      </div>
    );
  }

  const queue = data ?? initial;
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <Column
        title="New"
        orders={queue.new}
        cta="Open"
        emptyText="No incoming orders. New paid orders appear here."
      />
      <Column
        title="Ready · awaiting driver"
        orders={queue.ready}
        cta="Open"
        emptyText="Nothing ready for pickup."
      />
      <Column title="In progress" orders={queue.inProgress} cta="Open" emptyText="Nothing in progress." />
      <Column title="Completed" orders={queue.completed} cta="View" emptyText="No completed orders yet." />
    </div>
  );
}
