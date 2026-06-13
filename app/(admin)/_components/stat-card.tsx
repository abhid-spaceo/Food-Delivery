import { Card, CardContent } from "@/components/ui/card";

// KPI tile for the admin overview. Shows a big value and a label underneath.
export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="text-3xl font-bold tracking-tight tabular-nums">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
