"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markDelivered } from "../actions";

// Visual-only change: gradient variant, full-width. Text "Mark delivered" preserved for E2E.
export function DeliverButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="gradient"
      className="w-full"
      loading={pending}
      onClick={() => start(async () => { await markDelivered(orderId); })}
    >
      {pending ? "Updating…" : "Mark delivered"}
    </Button>
  );
}
