import * as React from "react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";

// Maps order, payment, and approval status strings to the semantic Badge
// variant so every status display in the app uses the same color logic.
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  // Order statuses
  PLACED: "info",
  ACCEPTED: "warning",
  PREPARING: "warning",
  READY: "success",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "success",
  REJECTED: "gray",
  CANCELLED: "gray",
  // Payment statuses
  PENDING: "warning",
  PAID: "success",
  REFUNDED: "gray",
  // Approval statuses
  APPROVED: "success",
  SUSPENDED: "gray",
};

interface StatusChipProps extends React.ComponentProps<"span"> {
  /** The raw status enum value, e.g. "PLACED", "READY", "APPROVED". */
  status: string;
  /** Human-readable label. Defaults to the status value if not provided. */
  label?: string;
}

function StatusChip({ status, label, ...props }: StatusChipProps) {
  const variant = STATUS_VARIANT[status] ?? "gray";
  return (
    <Badge variant={variant} {...props}>
      {label ?? status}
    </Badge>
  );
}

export { StatusChip };
