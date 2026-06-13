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
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
