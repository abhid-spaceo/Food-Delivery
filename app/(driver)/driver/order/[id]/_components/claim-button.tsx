"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { claimOrder } from "../actions";

export function ClaimButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await claimOrder(orderId);
            router.push("/driver/deliveries");
          } catch {
            // The order was taken (or no longer READY) — refresh to reflect reality.
            router.refresh();
          }
        })
      }
    >
      {pending ? "Claiming…" : "Claim this order"}
    </Button>
  );
}
