import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { Badge } from "@/app/(admin)/_components/badge";
import { ImageFrame } from "@/components/ui/image-frame";
import { EmptyState } from "@/components/ui/empty-state";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { getMyDeliveries } from "@/app/(driver)/_lib/deliveries";
import { formatCents, orderRef } from "@/app/(restaurant)/_lib/format";

// My deliveries ("/driver/deliveries"): active (out for delivery) + past (delivered),
// scoped to THIS driver.
// CRITICAL: Badge renders the RAW enum string (OUT_FOR_DELIVERY / DELIVERED).
// E2E does getByText("OUT_FOR_DELIVERY") and getByText("DELIVERED") — do NOT change.
export default async function DeliveriesPage() {
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") redirect("/driver");

  const { active, past } = await getMyDeliveries(driver.id);

  // Inline Row renders the raw status Badge — E2E asserts this text.
  function Row({
    o,
  }: {
    o: { id: string; status: string; totalCents: number; restaurant: { name: string } };
  }) {
    return (
      <Link href={`/driver/order/${o.id}`} className="block">
        <Card elevated className="transition-shadow">
          <CardContent className="flex items-center gap-3 p-4">
            <ImageFrame emoji="🍽️" size="sm" className="shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">
                {o.restaurant.name}
              </p>
              <p className="text-xs text-muted-foreground">{orderRef(o.id)}</p>
              {/* Raw enum Badge — E2E asserts "OUT_FOR_DELIVERY" / "DELIVERED" text */}
              <Badge value={o.status} />
            </div>
            <span className="shrink-0 font-bold text-foreground">
              {formatCents(o.totalCents)}
            </span>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <DriverShell title="My deliveries">
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Active
        </h2>
        {active.length === 0 ? (
          <EmptyState
            icon="🛵"
            title="Nothing out for delivery"
            description="Claim an order from the pool to start a delivery."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((o) => (
              <Row key={o.id} o={o} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Delivered
        </h2>
        {past.length === 0 ? (
          <EmptyState
            icon="📦"
            title="No completed deliveries yet"
            description="Your finished deliveries will appear here."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {past.map((o) => (
              <Row key={o.id} o={o} />
            ))}
          </div>
        )}
      </section>
    </DriverShell>
  );
}
