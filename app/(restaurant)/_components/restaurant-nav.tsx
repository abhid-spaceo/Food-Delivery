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
    <nav>
      <ul className="flex flex-col gap-0.5 p-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          // "/restaurant" is active only on exact match (orders detail lives
          // under it); the others match by prefix.
          const active = href === "/restaurant" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-[var(--dur-fast)]",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(255,59,92,0.3)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
