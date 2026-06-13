"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { devMarkPaid } from "../actions";

// Dev-only: simulate a successful payment (Phase 4 replaces with Stripe). The
// page only renders this while payment is PENDING.
export function MarkPaidButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() => start(async () => { await devMarkPaid(orderId); })}
    >
      {pending ? "Processing…" : "Mark as paid (dev)"}
    </Button>
  );
}
