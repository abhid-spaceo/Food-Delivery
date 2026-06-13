import { prisma } from "@/lib/db";
import { RestaurantStatus } from "@/lib/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Badge } from "@/app/(admin)/_components/badge";
import { FilterBar } from "@/app/(admin)/_components/filter-bar";
import { Table, THead, TBody, TR, TH, TD } from "@/app/(admin)/_components/table";
import { approveRestaurant, suspendRestaurant } from "./actions";

// Admin Restaurants ("/admin/restaurants", S15). Lists all restaurants with an
// optional ?status= filter. Approve/Suspend run as Server Actions (see actions.ts).
const FILTER_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Suspended", value: "SUSPENDED" },
];

// Narrow an untrusted ?status= value to a real RestaurantStatus, else undefined.
function parseStatus(raw: string | undefined): RestaurantStatus | undefined {
  if (raw && raw in RestaurantStatus) return raw as RestaurantStatus;
  return undefined;
}

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = parseStatus(status);

  const restaurants = await prisma.restaurant.findMany({
    where: filter ? { status: filter } : undefined,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, cuisine: true, status: true },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Restaurants</h1>
        <FilterBar
          basePath="/admin/restaurants"
          param="status"
          current={filter}
          options={FILTER_OPTIONS}
        />
      </div>

      {restaurants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No restaurants match this filter.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Cuisine</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {restaurants.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.name}</TD>
                <TD>{r.cuisine}</TD>
                <TD>
                  <Badge value={r.status} />
                </TD>
                <TD>
                  <div className="flex justify-end gap-2">
                    {r.status !== "APPROVED" && (
                      <form action={approveRestaurant}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button type="submit" size="sm">
                          Approve
                        </Button>
                      </form>
                    )}
                    {r.status !== "SUSPENDED" && (
                      <form action={suspendRestaurant}>
                        <input type="hidden" name="id" value={r.id} />
                        <Button type="submit" size="sm" variant="destructive">
                          Suspend
                        </Button>
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
