import Link from "next/link";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@/lib/generated/prisma/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/app/(admin)/_components/badge";
import { FilterBar } from "@/app/(admin)/_components/filter-bar";
import { formatCents } from "@/app/(admin)/_components/money";
import { Table, THead, TBody, TR, TH, TD } from "@/app/(admin)/_components/table";
import { Button } from "@/components/ui/button";
import { adminMarkPaid } from "./actions";

// Admin Orders ("/admin/orders", S17). All orders with an optional ?status=
// filter. ?id= opens a read-only detail panel above the table.
const FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Placed", value: "PLACED" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Preparing", value: "PREPARING" },
  { label: "Ready", value: "READY" },
  { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

// Narrow an untrusted ?status= value to a real OrderStatus, else undefined.
function parseStatus(raw: string | undefined): OrderStatus | undefined {
  if (raw && raw in OrderStatus) return raw as OrderStatus;
  return undefined;
}

async function OrderDetail({ id }: { id: string }) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      restaurant: { select: { name: true } },
      customer: { select: { name: true, email: true } },
      items: true,
      payment: { select: { status: true } },
    },
  });

  if (!order) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Order not found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="font-mono text-sm">{order.id}</span>
          <Badge value={order.status} />
          {order.payment && <Badge value={order.payment.status} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-muted-foreground">Restaurant: </span>
            {order.restaurant.name}
          </div>
          <div>
            <span className="text-muted-foreground">Customer: </span>
            {order.customer.name ?? order.customer.email}
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Deliver to: </span>
            {order.addressLine}
          </div>
        </div>

        <Table>
          <THead>
            <TR>
              <TH>Item</TH>
              <TH className="text-right">Qty</TH>
              <TH className="text-right">Price</TH>
            </TR>
          </THead>
          <TBody>
            {order.items.map((item) => (
              <TR key={item.id}>
                <TD>{item.name}</TD>
                <TD className="text-right tabular-nums">{item.quantity}</TD>
                <TD className="text-right tabular-nums">{formatCents(item.priceCents)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>

        <div className="flex justify-end gap-6 text-right">
          <div>
            <div className="text-muted-foreground">Subtotal</div>
            <div className="tabular-nums">{formatCents(order.subtotalCents)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Delivery</div>
            <div className="tabular-nums">{formatCents(order.deliveryFeeCents)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Total</div>
            <div className="font-semibold tabular-nums">{formatCents(order.totalCents)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; id?: string }>;
}) {
  const { status, id } = await searchParams;
  const filter = parseStatus(status);

  const orders = await prisma.order.findMany({
    where: filter ? { status: filter } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      restaurant: { select: { name: true } },
      customer: { select: { name: true, email: true } },
      payment: { select: { status: true } },
    },
  });

  // Preserve the active status filter when linking into a detail view.
  const detailQuery = filter ? `&status=${filter}` : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Orders</h1>
        <FilterBar
          basePath="/admin/orders"
          param="status"
          current={filter}
          options={FILTER_OPTIONS}
        />
      </div>

      {id && <OrderDetail id={id} />}

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders match this filter.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Order</TH>
              <TH>Restaurant</TH>
              <TH>Customer</TH>
              <TH>Status</TH>
              <TH>Payment</TH>
              <TH className="text-right">Total</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {orders.map((order) => (
              <TR key={order.id}>
                <TD className="font-mono text-xs">{order.id.slice(0, 8)}</TD>
                <TD>{order.restaurant.name}</TD>
                <TD>{order.customer.name ?? order.customer.email}</TD>
                <TD>
                  <Badge value={order.status} />
                </TD>
                <TD>
                  {order.payment ? (
                    <Badge value={order.payment.status} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TD>
                <TD className="text-right tabular-nums">{formatCents(order.totalCents)}</TD>
                <TD className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {(order.payment?.status ?? "PENDING") === "PENDING" && (
                      <form action={adminMarkPaid}>
                        <input type="hidden" name="id" value={order.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Mark paid
                        </Button>
                      </form>
                    )}
                    <Link
                      href={`/admin/orders?id=${order.id}${detailQuery}`}
                      className="text-primary hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
