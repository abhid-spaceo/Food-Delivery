import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { Badge } from "@/app/(admin)/_components/badge";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { getMyDeliveries } from "@/app/(driver)/_lib/deliveries";
import { formatCents, orderRef } from "@/app/(restaurant)/_lib/format";

// My deliveries ("/driver/deliveries"): active (out for delivery) + past (delivered),
// scoped to THIS driver.
export default async function DeliveriesPage() {
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") redirect("/driver");

  const { active, past } = await getMyDeliveries(driver.id);

  function Row({ o }: { o: { id: string; status: string; totalCents: number; restaurant: { name: string } } }) {
    return (
      <Link key={o.id} href={`/driver/order/${o.id}`} className="block">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{o.restaurant.name} · {orderRef(o.id)}</p>
              <Badge value={o.status} />
            </div>
            <span className="font-semibold">{formatCents(o.totalCents)}</span>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <DriverShell title="My deliveries">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing out for delivery.</p>
        ) : (
          <div className="flex flex-col gap-3">{active.map((o) => <Row key={o.id} o={o} />)}</div>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Delivered
        </h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed deliveries yet.</p>
        ) : (
          <div className="flex flex-col gap-3">{past.map((o) => <Row key={o.id} o={o} />)}</div>
        )}
      </section>
    </DriverShell>
  );
}
