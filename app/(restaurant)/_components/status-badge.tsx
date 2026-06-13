import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { statusLabel } from "@/app/(restaurant)/_lib/format";
import { StatusChip } from "@/components/ui/status-chip";

// Restaurant status pill. Re-implemented as a thin wrapper over ui/status-chip.
// Public API (StatusBadge({ status })) and rendered label text are preserved so
// E2E assertions like getByText("Placed", { exact: true }) continue to pass.

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <StatusChip status={status} label={statusLabel(status)} />;
}
