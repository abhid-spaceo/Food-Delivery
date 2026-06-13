// JSON the tracking page polls with SWR. Envelope { ok, data, error }. Owner-scoped:
// the order must belong to the caller (foreign/unknown id -> 404, no info leak).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCustomerId } from "@/app/(customer)/_lib/customer";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const customerId = await getCustomerId();
  if (!customerId) {
    return NextResponse.json({ ok: false, data: null, error: "Not authenticated" }, { status: 401 });
  }

  const order = await prisma.order.findFirst({
    where: { id, customerId },
    select: {
      status: true,
      payment: { select: { status: true } },
      events: { orderBy: { createdAt: "asc" }, select: { to: true, createdAt: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ ok: false, data: null, error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      status: order.status,
      paymentStatus: order.payment?.status ?? "PENDING",
      events: order.events.map((e) => ({ to: e.to, at: e.createdAt.toISOString() })),
    },
    error: null,
  });
}
