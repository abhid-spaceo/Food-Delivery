// JSON endpoint the queue board polls with SWR (CLAUDE.md: polling only where
// status changes; never websockets). URL: /restaurant/orders/queue. Gated by
// the proxy (RESTAURANT role) AND re-scoped to the caller's OWN restaurant here.
// Envelope: { ok, data, error }.
import { NextResponse } from "next/server";
import { getOwnedRestaurant } from "@/app/(restaurant)/_lib/restaurant";
import { getQueue } from "@/app/(restaurant)/_lib/queue";

export async function GET() {
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) {
    return NextResponse.json(
      { ok: false, data: null, error: "No restaurant for this account" },
      { status: 403 },
    );
  }
  const data = await getQueue(restaurant.id);
  return NextResponse.json({ ok: true, data, error: null });
}
