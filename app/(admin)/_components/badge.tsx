import * as React from "react";
import { cn } from "@/lib/utils";

// Small status pill for restaurant/order/payment statuses. Color is keyed off
// the status string so the same component serves every admin table.
const TONE: Record<string, string> = {
  // Restaurant statuses
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  SUSPENDED: "bg-red-100 text-red-800",
  // Order statuses
  PLACED: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-indigo-100 text-indigo-800",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-teal-100 text-teal-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-200 text-gray-700",
  // Roles (reused as plain pills)
  CUSTOMER: "bg-gray-100 text-gray-700",
  RESTAURANT: "bg-sky-100 text-sky-800",
  DRIVER: "bg-teal-100 text-teal-800",
  ADMIN: "bg-fuchsia-100 text-fuchsia-800",
};

export function Badge({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONE[value] ?? "bg-gray-100 text-gray-700",
        className,
      )}
    >
      {value}
    </span>
  );
}
