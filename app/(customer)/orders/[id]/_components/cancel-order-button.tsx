"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelOrder } from "../actions";

// Cancel is only offered while PLACED (the page gates this). Confirms first.
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (window.confirm("Cancel this order?")) {
          start(async () => { await cancelOrder(orderId); });
        }
      }}
    >
      {pending ? "Cancelling…" : "Cancel order"}
    </Button>
  );
}
