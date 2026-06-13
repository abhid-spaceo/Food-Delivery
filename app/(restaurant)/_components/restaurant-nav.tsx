"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, UtensilsCrossed, Store } from "lucide-react";
import { cn } from "@/lib/utils";

// Left nav rail for the restaurant dashboard. Client component so it can
// highlight the active route via usePathname. Orders is the primary/landing
// item (fulfillment is the owner's main job) — see WIREFRAMES S10.
const LINKS = [
  { href: "/restaurant", label: "Orders", icon: ClipboardList },
  { href: "/restaurant/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/restaurant/profile", label: "Profile", icon: Store },
] as const;

export function RestaurantNav() {
  const pathname = usePathname();
  return (
    <nav className="w-44 shrink-0">
      <ul className="flex flex-col gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          // "/restaurant" is active only on exact match (orders detail lives
          // under it); the others match by prefix.
          const active = href === "/restaurant" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
