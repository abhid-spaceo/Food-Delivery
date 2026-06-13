import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { statusLabel } from "@/app/(restaurant)/_lib/format";

// Small colored pill for an order's lifecycle state. Pure presentation.
const STYLES: Record<OrderStatus, string> = {
  PLACED: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-amber-100 text-amber-800",
  PREPARING: "bg-amber-100 text-amber-800",
  OUT_FOR_DELIVERY: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-200 text-gray-700",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[status],
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
