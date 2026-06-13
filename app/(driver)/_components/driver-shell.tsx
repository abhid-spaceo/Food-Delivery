// app/(driver)/_components/driver-shell.tsx
import { AppHeader } from "@/components/app-header";
import { DriverNav } from "@/app/(driver)/_components/driver-nav";
import { OnlineToggle } from "@/app/(driver)/_components/online-toggle";
import { getDriver } from "@/app/(driver)/_lib/driver";

// Shell for all driver screens: shared AppHeader, a real online/offline toggle
// pill (Phase 5), a nav rail, and a content slot.
export async function DriverShell({ title, children }: { title: string; children: React.ReactNode }) {
  const driver = await getDriver();
  const isOnline = driver?.isOnline ?? false;

  return (
    <div>
      {/* Top bar: shared app header + real online/offline toggle */}
      <div className="sticky top-0 z-40 flex items-center border-b bg-card/90 backdrop-blur-md">
        <div className="flex-1">
          <AppHeader title="Driver" />
        </div>
        <div className="mr-4 shrink-0">
          <OnlineToggle isOnline={isOnline} />
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl gap-8 px-6 py-8">
        <aside className="w-52 shrink-0 self-start rounded-xl border bg-card p-2 shadow-[var(--shadow-sm)]">
          <DriverNav />
        </aside>
        <main className="min-w-0 flex-1">
          <h1 className="mb-6 text-2xl font-bold tracking-tight">{title}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
