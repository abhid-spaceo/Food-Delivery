import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { getEarnings, getMyDeliveries } from "@/app/(driver)/_lib/deliveries";
import { formatCents } from "@/app/(restaurant)/_lib/format";

// Earnings ("/driver/earnings"): total delivered-fee tally (display only, no
// payouts) + stat tiles, scoped to THIS driver.
// formatCents(totalCents) renders "$2.99" — preserved for E2E.
export default async function EarningsPage() {
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") redirect("/driver");

  const [totalCents, { past }] = await Promise.all([
    getEarnings(driver.id),
    getMyDeliveries(driver.id),
  ]);

  return (
    <DriverShell title="Your earnings">
      {/* Gradient total card — matches D6 mockup */}
      <Card
        className="mb-4 border-none text-white sm:max-w-md"
        style={{ background: "var(--gradient-brand)" }}
      >
        <CardContent className="p-6">
          <p className="text-xs font-bold uppercase tracking-wide opacity-90">Total earned</p>
          {/* formatCents output e.g. "$2.99" — E2E asserts this */}
          <p className="mt-1 text-4xl font-black tabular-nums">{formatCents(totalCents)}</p>
          <p className="mt-1 text-sm opacity-90">from {past.length} delivered orders</p>
        </CardContent>
      </Card>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-black tabular-nums text-foreground">{past.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 text-center">
            <p className="text-3xl font-black tabular-nums text-foreground">
              {past.length > 0 ? formatCents(Math.round(totalCents / past.length)) : "—"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Avg per delivery</p>
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Earnings = sum of delivery fees on your delivered orders. Display only — no payout integration.
      </p>
    </DriverShell>
  );
}
