import { Check, X, ChefHat, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextStatuses } from "@/lib/orders/state";
import { actionLabel } from "@/app/(restaurant)/_lib/format";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import {
  acceptOrder,
  rejectOrder,
  startPreparing,
  markReady,
} from "@/app/(restaurant)/restaurant/orders/[id]/actions";

// Renders ONLY the buttons legal for the order's current status, driven by
// nextStatuses(status) from the state machine (single source of truth). Each
// button posts to its bound Server Action (no client JS). A terminal order
// (DELIVERED/REJECTED/CANCELLED) yields no buttons.
const ACTION_FOR: Record<OrderStatus, ((orderId: string) => Promise<void>) | undefined> = {
  ACCEPTED: acceptOrder,
  REJECTED: rejectOrder,
  PREPARING: startPreparing,
  READY: markReady,
  OUT_FOR_DELIVERY: undefined, // driver-driven (claim from pool), never a restaurant button
  DELIVERED: undefined, // driver-driven
  PLACED: undefined, // PLACED is never a transition target here
  CANCELLED: undefined, // customer/admin-only branch
};

// Decorative icon paired with each transition target; does not affect the label.
const ACTION_ICON: Partial<Record<OrderStatus, React.ReactNode>> = {
  ACCEPTED: <Check className="size-4" />,
  REJECTED: <X className="size-4" />,
  PREPARING: <ChefHat className="size-4" />,
  READY: <PackageCheck className="size-4" />,
};

export function OrderActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const targets = nextStatuses(status).filter((t) => ACTION_FOR[t]);

  if (targets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No further actions for this order.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {targets.map((to) => {
        const action = ACTION_FOR[to]!;
        return (
          <form key={to} action={action.bind(null, orderId)}>
            <Button type="submit" variant={to === "REJECTED" ? "destructive" : "default"}>
              {ACTION_ICON[to]}
              {actionLabel(to)}
            </Button>
          </form>
        );
      })}
    </div>
  );
}
