"use client";

import useSWR from "swr";
import { isTerminal } from "@/lib/orders/state";
import { statusLabel } from "@/app/(customer)/_lib/format";
import { Timeline } from "@/components/ui/timeline";
import type { TimelineStep } from "@/components/ui/timeline";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

interface StatusData {
  status: OrderStatus;
  paymentStatus: string;
  events: { to: OrderStatus; at: string }[];
}

// All states in display order — used to build pending steps after the current event.
const ALL_STATUSES: OrderStatus[] = [
  "PLACED",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

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
    // Stop polling once terminal — isTerminal is preserved from the original
    refreshInterval: (latest) => (latest && isTerminal(latest.status) ? 0 : 5000),
  });

  const view = data ?? initial;

  if (error) {
    return (
      <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        Couldn&apos;t load status. It will retry automatically.
      </p>
    );
  }

  // Build Timeline steps:
  // - Events that happened → "done"
  // - The current status → "current" (if not terminal, else "done")
  // - Future states in the happy path → "pending"
  // For cancelled/rejected orders we skip the happy-path futures.
  const eventStatuses = view.events.map((e) => e.to);
  const lastEvent = eventStatuses[eventStatuses.length - 1];
  const terminal = isTerminal(view.status);
  const isCancelled = view.status === "CANCELLED" || view.status === "REJECTED";

  const steps: TimelineStep[] = [];

  if (isCancelled) {
    // Show events up to and including the terminal state
    view.events.forEach((e, idx) => {
      const isLast = idx === view.events.length - 1;
      const at = new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      steps.push({
        label: statusLabel(e.to),
        description: at,
        state: isLast ? "current" : "done",
      });
    });
  } else {
    // Show events that occurred
    view.events.forEach((e, idx) => {
      const isCurrentEvent = idx === view.events.length - 1 && lastEvent === view.status;
      const at = new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      steps.push({
        label: statusLabel(e.to),
        description: at,
        state: isCurrentEvent && !terminal ? "current" : "done",
      });
    });

    // Append pending future states from the happy path
    const reachedIdx = ALL_STATUSES.indexOf(view.status);
    const futureStatuses = reachedIdx >= 0 ? ALL_STATUSES.slice(reachedIdx + 1) : [];
    futureStatuses.forEach((s) => {
      steps.push({ label: statusLabel(s), state: "pending" });
    });

    // If current status is terminal "done" (DELIVERED), mark last step done
    if (terminal && steps.length > 0) {
      const lastIdx = steps.findIndex((s) => s.state === "current");
      if (lastIdx !== -1) steps[lastIdx] = { ...steps[lastIdx], state: "done" };
    }
  }

  return (
    <div className="mt-4">
      {steps.length > 0 ? (
        <Timeline steps={steps} />
      ) : null}

      {/* data-testid="current-status" is REQUIRED by the E2E suite — do not remove or rename */}
      <p
        className="mt-4 text-sm text-muted-foreground"
        data-testid="current-status"
      >
        Current status:{" "}
        <span className="font-semibold text-foreground">{statusLabel(view.status)}</span>
      </p>
    </div>
  );
}
