import { Card, CardContent } from "@/components/ui/card";

// KPI tile for the admin overview. Shows a big value and a label underneath.
export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
