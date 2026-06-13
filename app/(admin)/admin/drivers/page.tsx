import { prisma } from "@/lib/db";
import { DriverStatus } from "@/lib/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/app/(admin)/_components/badge";
import { FilterBar } from "@/app/(admin)/_components/filter-bar";
import { Table, THead, TBody, TR, TH, TD } from "@/app/(admin)/_components/table";
import { ImageFrame } from "@/components/ui/image-frame";
import { approveDriver, suspendDriver } from "./actions";

// Admin Drivers ("/admin/drivers"). Lists drivers with an optional ?status= filter.
// Approve/Suspend run as Server Actions. Mirrors admin/restaurants/page.tsx.
const FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Suspended", value: "SUSPENDED" },
];

function parseStatus(raw: string | undefined): DriverStatus | undefined {
  if (raw && raw in DriverStatus) return raw as DriverStatus;
  return undefined;
}

export default async function AdminDriversPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = parseStatus(status);

  const drivers = await prisma.driver.findMany({
    where: filter ? { status: filter } : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      status: true,
      user: { select: { email: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Drivers</h1>
        <FilterBar basePath="/admin/drivers" param="status" current={filter} options={FILTER_OPTIONS} />
      </div>

      {drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drivers match this filter.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH className="w-12"></TH>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {drivers.map((d) => (
              <TR key={d.id}>
                <TD>
                  <ImageFrame emoji="🛵" size="sm" />
                </TD>
                <TD className="font-semibold">{d.name}</TD>
                <TD className="text-muted-foreground">{d.user.email}</TD>
                <TD>
                  <Badge value={d.status} />
                </TD>
                <TD>
                  <div className="flex justify-end gap-2">
                    {d.status !== "APPROVED" && (
                      <form action={approveDriver}>
                        <input type="hidden" name="id" value={d.id} />
                        <Button type="submit" size="sm">Approve</Button>
                      </form>
                    )}
                    {d.status !== "SUSPENDED" && (
                      <form action={suspendDriver}>
                        <input type="hidden" name="id" value={d.id} />
                        <Button type="submit" size="sm" variant="destructive">Suspend</Button>
                      </form>
                    )}
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
