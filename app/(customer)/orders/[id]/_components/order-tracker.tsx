"use client";

import useSWR from "swr";
import { isTerminal } from "@/lib/orders/state";
import { statusLabel } from "@/app/(customer)/_lib/format";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

interface StatusData {
  status: OrderStatus;
  paymentStatus: string;
  events: { to: OrderStatus; at: string }[];
}

const fetcher = async (url: string): Promise<StatusData> => {
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(body.error ?? "Failed to load status");
  return body.data as StatusData;
};

// Polls the status route every 5s (CLAUDE.md: polling, not push) and stops once
// the order is terminal. `initial` seeds the first paint (SWR fallback).
export function OrderTracker({ orderId, initial }: { orderId: string; initial: StatusData }) {
  const { data, error } = useSWR<StatusData>(`/orders/${orderId}/status`, fetcher, {
    fallbackData: initial,
    refreshInterval: (latest) => (latest && isTerminal(latest.status) ? 0 : 5000),
  });

  const view = data ?? initial;

  if (error) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        Couldn&apos;t load status. It will retry automatically.
      </p>
    );
  }

  return (
    <ol className="mt-4 space-y-2">
      {view.events.map((e, idx) => (
        <li key={idx} className="flex items-center gap-3 text-sm">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <span className="font-medium">{statusLabel(e.to)}</span>
        </li>
      ))}
      <li className="text-sm text-muted-foreground" data-testid="current-status">
        Current status: <span className="font-semibold">{statusLabel(view.status)}</span>
      </li>
    </ol>
  );
}
