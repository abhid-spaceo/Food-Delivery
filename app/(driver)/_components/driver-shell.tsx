// app/(driver)/_components/driver-shell.tsx
import { AppHeader } from "@/components/app-header";
import { DriverNav } from "@/app/(driver)/_components/driver-nav";

// Shell for all driver screens: shared AppHeader, a nav rail, and a content slot.
// Mirrors the restaurant DashboardShell.
export function DriverShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <AppHeader title="Driver" />
      <div className="mx-auto flex max-w-5xl gap-8 px-6 py-8">
        <aside className="w-52 shrink-0 self-start rounded-xl border bg-card p-2 shadow-sm">
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
