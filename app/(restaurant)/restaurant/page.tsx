import { DashboardShell } from "@/app/(restaurant)/_components/dashboard-shell";
import { QueueBoard } from "@/app/(restaurant)/_components/queue-board";
import { getOwnedRestaurant } from "@/app/(restaurant)/_lib/restaurant";
import { getQueue } from "@/app/(restaurant)/_lib/queue";

// Orders queue ("/restaurant"). THIS owner's restaurant's PAID orders, grouped
// New / In-progress / Completed (WIREFRAMES S10). Server-renders the initial
// snapshot; the client board then polls for updates.
export default async function RestaurantOrdersPage() {
  const restaurant = await getOwnedRestaurant();

  if (!restaurant) {
    return (
      <DashboardShell title="Orders">
        <p className="text-sm text-muted-foreground">
          No restaurant is linked to this account yet.
        </p>
      </DashboardShell>
    );
  }

  const initial = await getQueue(restaurant.id);

  return (
    <DashboardShell title="Orders">
      <QueueBoard initial={initial} />
    </DashboardShell>
  );
}
