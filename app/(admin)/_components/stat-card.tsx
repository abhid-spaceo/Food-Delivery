import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";

// KPI tile for the admin overview. Shows an optional icon, a large tabular-nums
// value, and a label underneath. Hover lifts the card via the Card `elevated` prop.
export function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <Card elevated>
      <CardContent className="p-5">
        {icon && (
          <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-brand-soft text-primary">
            {icon}
          </div>
        )}
        <div className="text-3xl font-black tracking-tight tabular-nums text-foreground">{value}</div>
        <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
