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
      <Card>
        <CardContent className="space-y-3 p-6 text-sm">
          {!driver ? (
            <p className="text-muted-foreground">
              No driver profile is linked to this account.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span>Application status:</span>
                <Badge value={driver.status} />
              </div>
              <p className="text-muted-foreground">
                {driver.status === "PENDING"
                  ? "Your application is awaiting admin approval. Once approved, the pickup pool unlocks."
                  : "Your account is suspended. Contact an admin."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </DriverShell>
  );
}
