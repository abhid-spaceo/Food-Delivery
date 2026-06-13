import { AppHeader } from "@/components/app-header";
import { RestaurantNav } from "@/app/(restaurant)/_components/restaurant-nav";

// Dashboard shell for all restaurant screens: shared AppHeader on top, a left
// nav rail (Orders / Menu / Profile), and a content slot. Server component.
export function DashboardShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <AppHeader title="Restaurant dashboard" />
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <aside className="w-52 shrink-0 self-start rounded-xl border bg-card p-2 shadow-sm">
          <RestaurantNav />
        </aside>
        <main className="min-w-0 flex-1">
          <h1 className="mb-6 text-2xl font-bold tracking-tight">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
