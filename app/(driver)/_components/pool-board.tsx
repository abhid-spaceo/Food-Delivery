// app/(driver)/_components/pool-board.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCents, orderRef } from "@/app/(restaurant)/_lib/format";
import type { PoolOrder } from "@/app/(driver)/_lib/deliveries";

const fetcher = async (url: string): Promise<PoolOrder[]> => {
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(body.error ?? "Failed to load pool");
  return body.data as PoolOrder[];
};

// Polls the pool every 5s so claimed orders disappear and new READY orders appear
// without a reload (CLAUDE.md: polling, not push).
export function PoolBoard({ initial }: { initial: PoolOrder[] }) {
  const { data, error } = useSWR<PoolOrder[]>("/driver/pool/api", fetcher, {
    fallbackData: initial,
    refreshInterval: 5000,
  });

  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Couldn&apos;t load the pool. It will retry automatically.
      </p>
    );
  }

  const pool = data ?? initial;
  if (pool.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
        No orders ready for pickup right now.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {pool.map((o) => (
        <Card key={o.id}>
          <CardContent className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">{o.restaurantName}</span>
              <span className="text-xs text-muted-foreground">{orderRef(o.id)}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {o.itemCount} {o.itemCount === 1 ? "item" : "items"} · Earn{" "}
              {formatCents(o.deliveryFeeCents)}
            </span>
            <Button asChild size="sm" className="mt-1 self-start">
              <Link href={`/driver/order/${o.id}`}>View &amp; claim</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
