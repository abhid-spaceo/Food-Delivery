// app/(driver)/driver/pool/route.ts
// JSON the pool board polls with SWR. Envelope { ok, data, error }. Gated by the
// proxy (DRIVER role) AND re-checked here: only an APPROVED driver sees the pool.
import { NextResponse } from "next/server";
import { getDriver } from "@/app/(driver)/_lib/driver";
import { getPool } from "@/app/(driver)/_lib/deliveries";

export async function GET() {
  const driver = await getDriver();
  if (driver?.status !== "APPROVED") {
    return NextResponse.json(
      { ok: false, data: null, error: "Driver is not approved" },
      { status: 403 },
    );
  }
  const data = await getPool();
  return NextResponse.json({ ok: true, data, error: null });
}
