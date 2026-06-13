import { AppHeader } from "@/components/app-header";
import { AdminNav } from "@/app/(admin)/_components/admin-nav";

// Shared chrome for every /admin screen: the authenticated header plus the
// left sidebar (Overview / Restaurants / Users / Orders). Route access is gated
// by the proxy (ADMIN role); each Server Action re-checks the role too.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Admin console" />
      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-8">
        {/* Dark rounded sidebar rail — sticky so it stays visible while scrolling */}
        <aside className="w-56 shrink-0">
          <div className="sticky top-[4.5rem] rounded-2xl bg-[#15141a] p-2 text-white shadow-[var(--shadow-card)]">
            <AdminNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
