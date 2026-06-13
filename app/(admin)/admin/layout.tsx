import { AppHeader } from "@/components/app-header";
import { AdminNav } from "@/app/(admin)/_components/admin-nav";

// Shared chrome for every /admin screen: the authenticated header plus the
// left sidebar (Overview / Restaurants / Users / Orders). Route access is gated
// by the proxy (ADMIN role); each Server Action re-checks the role too.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AppHeader title="Admin dashboard" />
      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-8">
        <aside className="w-52 shrink-0 self-start rounded-xl bg-[#15141a] p-2 text-white shadow-sm">
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
