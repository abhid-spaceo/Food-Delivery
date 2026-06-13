// app/(driver)/_components/driver-shell.tsx
import { AppHeader } from "@/components/app-header";
import { DriverNav } from "@/app/(driver)/_components/driver-nav";

// Shell for all driver screens: shared AppHeader, an "Online" status pill
// (visual-only; functional toggle is Phase 5), a nav rail, and a content slot.
export function DriverShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      {/* Top bar: shared app header + static online status pill */}
      <div className="sticky top-0 z-40 flex items-center border-b bg-card/90 backdrop-blur-md">
        <div className="flex-1">
          <AppHeader title="Driver" />
        </div>
        {/* Static "Online" pill — visual only. Toggle is a Phase 5 feature. */}
        <div className="mr-4 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success)] bg-[var(--success-soft)] px-3 py-1 text-xs font-semibold text-[var(--success)]">
            <span className="size-2 rounded-full bg-[var(--success)]" aria-hidden="true" />
            Online
          </span>
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
