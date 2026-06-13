import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { getEarnings, getMyDeliveries } from "@/app/(driver)/_lib/deliveries";
import { formatCents } from "@/app/(restaurant)/_lib/format";

// Earnings ("/driver/earnings"): total delivered-fee tally (display only, no
// payouts) + delivered count, scoped to THIS driver.
export default async function EarningsPage() {
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") redirect("/driver");

  const [totalCents, { past }] = await Promise.all([
    getEarnings(driver.id),
    getMyDeliveries(driver.id),
  ]);

  return (
    <DriverShell title="Earnings">
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="text-3xl font-bold tabular-nums">{formatCents(totalCents)}</div>
            <div className="mt-1 text-sm text-muted-foreground">Total earned (delivered fees)</div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="text-3xl font-bold tabular-nums">{past.length}</div>
            <div className="mt-1 text-sm text-muted-foreground">Deliveries completed</div>
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Earnings are display-only in this build (no payouts).
      </p>
    </DriverShell>
  );
}
