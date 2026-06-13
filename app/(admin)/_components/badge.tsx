import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge as UiBadge } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";

// Admin-local Badge. Re-implemented as a thin wrapper over the shared ui/badge.
// Public API is unchanged — { value, className } — so every admin table
// import keeps working without modification.
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const TONE: Record<string, BadgeVariant> = {
  // Restaurant / driver approval statuses
  PENDING: "warning",
  APPROVED: "success",
  SUSPENDED: "gray",
  // Order statuses
  PLACED: "info",
  ACCEPTED: "warning",
  PREPARING: "warning",
  READY: "success",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "success",
  REJECTED: "gray",
  CANCELLED: "gray",
  // Roles
  CUSTOMER: "gray",
  RESTAURANT: "info",
  DRIVER: "success",
  ADMIN: "brand",
};

export function Badge({ value, className }: { value: string; className?: string }) {
  const variant = TONE[value] ?? "gray";
  return (
    <UiBadge variant={variant} className={cn(className)}>
      {value}
    </UiBadge>
  );
}
