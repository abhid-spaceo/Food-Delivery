// app/(driver)/driver/pool/page.tsx
import { redirect } from "next/navigation";
import { DriverShell } from "@/app/(driver)/_components/driver-shell";
import { PoolBoard } from "@/app/(driver)/_components/pool-board";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { getPool } from "@/app/(driver)/_lib/deliveries";

// Pickup pool ("/driver/pool"). APPROVED drivers only; others bounce to /driver
// (the awaiting-approval screen).
export default async function PoolPage() {
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") redirect("/driver");

  const initial = await getPool();
  return (
    <DriverShell title="Orders ready for pickup">
      <PoolBoard initial={initial} />
    </DriverShell>
  );
}
