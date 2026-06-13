// app/(driver)/_components/pool-board.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageFrame } from "@/components/ui/image-frame";
import { EmptyState } from "@/components/ui/empty-state";
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
      <EmptyState
        icon="⚠️"
        title="Couldn't load the pool"
        description="It will retry automatically."
        className="border-destructive/30 bg-destructive/5 text-destructive"
      />
    );
  }

  const pool = data ?? initial;
  if (pool.length === 0) {
    return (
      <EmptyState
        icon="🛵"
        title="No orders ready right now"
        description="Check back soon — new pickups appear automatically."
      />
    );
  }

  return (
    <div className="space-y-1">
      {/* Live-update note */}
      <p className="mb-3 text-xs text-muted-foreground">⟳ updates every 5 s</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {pool.map((o) => (
          <Card key={o.id} elevated className="overflow-hidden">
            <CardContent className="p-4">
              {/* Restaurant row */}
              <div className="flex items-start gap-3">
                <ImageFrame emoji="🍽️" size="sm" className="mt-0.5 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">
                    {o.restaurantName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.itemCount} {o.itemCount === 1 ? "item" : "items"} ·{" "}
                    {orderRef(o.id)}
                  </p>
                </div>
                {/* Fee highlight on the right */}
                <div className="shrink-0 text-right">
                  <p className="font-bold text-foreground">
                    {formatCents(o.deliveryFeeCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">your fee</p>
                </div>
              </div>

              {/* Separator */}
              <div className="my-3 border-t" />

              {/* Footer: Ready chip + CTA */}
              <div className="flex items-center justify-between gap-2">
                <Badge variant="success">Ready</Badge>
                <Button asChild size="sm" variant="gradient">
                  <Link href={`/driver/order/${o.id}`}>View &amp; claim</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
