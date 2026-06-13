// app/(driver)/_components/driver-nav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PackageSearch, Truck, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/driver/pool", label: "Pickup pool", icon: PackageSearch },
  { href: "/driver/deliveries", label: "My deliveries", icon: Truck },
  { href: "/driver/earnings", label: "Earnings", icon: Wallet },
];

export function DriverNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 p-2">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-[var(--dur-fast)]",
              active
                ? "bg-primary text-primary-foreground shadow-[var(--shadow-sm)]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                active ? "opacity-100" : "opacity-70",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
