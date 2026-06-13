"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "../actions";

// Initiates a Stripe Checkout session and redirects the customer to the hosted
// payment page. Shown above the dev "Mark as paid" button while payment is PENDING.
export function PayButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="gradient"
      disabled={pending}
      className="shrink-0"
      onClick={() =>
        start(async () => {
          const url = await createCheckoutSession(orderId);
          window.location.assign(url);
        })
      }
    >
      {pending ? "Redirecting…" : "Pay with card"}
    </Button>
  );
}
