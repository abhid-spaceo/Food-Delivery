import { AppHeader } from "@/components/app-header";
import { RestaurantNav } from "@/app/(restaurant)/_components/restaurant-nav";

// Dashboard shell for all restaurant screens: shared AppHeader on top, a light
// card sidebar rail, and a content slot. Server component.
export function DashboardShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Restaurant dashboard" />
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        {/* Light card sidebar — sticky so it stays in view while scrolling */}
        <aside className="w-52 shrink-0">
          <div className="sticky top-[4.5rem] rounded-2xl border bg-card p-2 shadow-[var(--shadow-card)]">
            <RestaurantNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <h1 className="mb-6 text-2xl font-black tracking-tight">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
