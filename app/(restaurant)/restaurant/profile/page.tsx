import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOwnedRestaurant } from "@/app/(restaurant)/_lib/restaurant";
import { DashboardShell } from "@/app/(restaurant)/_components/dashboard-shell";
import { updateProfile } from "@/app/(restaurant)/restaurant/profile/actions";

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
      <Card className="max-w-xl">
        <CardContent className="p-6">
          <form action={updateProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={restaurant.name} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="cuisine">Cuisine</Label>
              <Input id="cuisine" name="cuisine" defaultValue={restaurant.cuisine} required />
            </div>
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
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Status:</span>
              {/* Read-only — admin-controlled approval state */}
              <span className="text-muted-foreground">{restaurant.status}</span>
            </div>
            <div>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
