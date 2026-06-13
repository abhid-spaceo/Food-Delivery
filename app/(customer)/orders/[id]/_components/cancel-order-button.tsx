"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelOrder } from "../actions";

// Cancel is only offered while PLACED (the page gates this). Confirms first.
// KEEP window.confirm — E2E does page.on("dialog", d => d.accept()) on this.
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      className="border-destructive/50 text-destructive hover:bg-destructive/5 hover:text-destructive"
      onClick={() => {
        // window.confirm is required for E2E — do NOT replace with a Dialog component
        if (window.confirm("Cancel this order?")) {
          start(async () => { await cancelOrder(orderId); });
        }
      }}
    >
      {pending ? "Cancelling…" : "Cancel order"}
    </Button>
  );
}
