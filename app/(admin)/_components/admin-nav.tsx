"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Store, Car, Users, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";

// Admin sidebar (S14-S17 wireframes). Highlights the active section based on the
// current path. Client component only because it reads usePathname for styling.
const LINKS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/restaurants", label: "Restaurants", icon: Store, exact: false },
  { href: "/admin/drivers", label: "Drivers", icon: Car, exact: false },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText, exact: false },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {LINKS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-[var(--dur-fast)]",
              active
                ? "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(255,59,92,0.4)]"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
