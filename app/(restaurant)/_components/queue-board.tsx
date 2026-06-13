"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/app/(restaurant)/_components/status-badge";
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

function OrderCard({ order, cta }: { order: QueueOrder; cta: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">{orderRef(order.id)}</span>
          <StatusBadge status={order.status} />
        </div>
        <span className="text-sm text-muted-foreground">
          {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
        </span>
        <span className="text-sm font-semibold">{formatCents(order.totalCents)}</span>
        <Button asChild variant="outline" size="sm" className="mt-1 self-start">
          <Link href={`/restaurant/orders/${order.id}`}>{cta}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

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
  return (
    <section className="min-w-0 flex-1">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title} ({orders.length})
      </h2>
      <div className="flex flex-col gap-3">
        {orders.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} cta={cta} />)
        )}
      </div>
    </section>
  );
}

export function QueueBoard({ initial }: { initial: QueueData }) {
  const { data, error } = useSWR<QueueData>("/restaurant/orders/queue", fetcher, {
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

  const queue = data ?? initial;
  return (
    <div className="flex flex-col gap-6 md:flex-row">
      <Column
        title="New"
        orders={queue.new}
        cta="Open"
        emptyText="No incoming orders. New paid orders appear here."
      />
      <Column title="In progress" orders={queue.inProgress} cta="Open" emptyText="Nothing in progress." />
      <Column title="Completed" orders={queue.completed} cta="View" emptyText="No completed orders yet." />
    </div>
  );
}
