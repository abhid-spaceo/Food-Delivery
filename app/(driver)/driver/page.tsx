// app/(driver)/driver/page.tsx
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { Badge } from "@/app/(admin)/_components/badge";
import { getDriver } from "@/app/(driver)/_lib/driver";

// Driver entry ("/driver"). APPROVED -> pickup pool. Otherwise an awaiting-approval
// screen (a PENDING driver passes the role guard but cannot claim yet).
export default async function DriverHomePage() {
  const driver = await getDriver();
  if (driver?.status === "APPROVED") redirect("/driver/pool");

  return (
    <DriverShell title="Welcome">
      {!driver ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No driver profile is linked to this account.
          </CardContent>
        </Card>
      ) : (
        /* Pending / suspended — visually distinct warning card */
        <Card className="overflow-hidden border-l-4 border-l-[var(--warning)]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-4">
              <span className="text-3xl" aria-hidden="true">
                {driver.status === "PENDING" ? "⏳" : "🚫"}
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Application status:</span>
                  <Badge value={driver.status} />
                </div>
                {/* E2E queries /awaiting admin approval/i — keep this text verbatim */}
                <p className="text-sm text-muted-foreground">
                  {driver.status === "PENDING"
                    ? "Your application is awaiting admin approval. Once approved, the pickup pool unlocks."
                    : "Your account is suspended. Contact an admin."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </DriverShell>
  );
}
