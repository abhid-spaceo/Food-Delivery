import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/ui/status-chip";
import { getOwnedRestaurant } from "@/app/(restaurant)/_lib/restaurant";
import { DashboardShell } from "@/app/(restaurant)/_components/dashboard-shell";
import { updateProfile, toggleAcceptingOrders } from "@/app/(restaurant)/restaurant/profile/actions";

// Restaurant Profile ("/restaurant/profile"). Edit name, cuisine, hours, and
// delivery area (WIREFRAMES S13). Status is read-only — only an admin can
// approve/suspend. The form posts to a Server Action that re-checks ownership.
export default async function ProfilePage() {
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) {
    return (
      <DashboardShell title="Profile">
        <p className="text-sm text-muted-foreground">
          No restaurant is linked to this account yet.
        </p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Profile">
      <div className="flex max-w-xl flex-col gap-6">
        {/* Read-only approval status banner */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Approval status</CardTitle>
              <StatusChip status={restaurant.status} />
            </div>
            <CardDescription>
              Your restaurant&apos;s visibility is controlled by an admin. Only{" "}
              <strong>Approved</strong> restaurants are shown to customers.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Open / closed toggle */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Store status</CardTitle>
                <CardDescription>
                  When closed, customers cannot place new orders.
                </CardDescription>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  restaurant.isAcceptingOrders
                    ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                <span
                  className={`size-2 rounded-full ${restaurant.isAcceptingOrders ? "bg-[var(--success)]" : "bg-muted-foreground"}`}
                  aria-hidden="true"
                />
                {restaurant.isAcceptingOrders ? "Open" : "Closed"}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <form action={toggleAcceptingOrders}>
              <input
                type="hidden"
                name="isAcceptingOrders"
                value={(!restaurant.isAcceptingOrders).toString()}
              />
              <Button type="submit" variant="outline">
                {restaurant.isAcceptingOrders ? "Close store" : "Open store"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Editable profile fields */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Restaurant details</CardTitle>
            <CardDescription>Update your public-facing information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfile} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={restaurant.name} required />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="cuisine">Cuisine</Label>
                  <Input id="cuisine" name="cuisine" defaultValue={restaurant.cuisine} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="hours">Hours</Label>
                  <Input
                    id="hours"
                    name="hours"
                    defaultValue={restaurant.hours ?? ""}
                    placeholder="Mon–Sun 10:00–22:00"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="deliveryArea">Delivery area</Label>
                  <Input
                    id="deliveryArea"
                    name="deliveryArea"
                    defaultValue={restaurant.deliveryArea ?? ""}
                    placeholder="City center; 5km"
                  />
                </div>
              </div>
              <div>
                <Button type="submit">Save changes</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
