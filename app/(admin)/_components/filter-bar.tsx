import Link from "next/link";
import { cn } from "@/lib/utils";

// Link-based filter row used by the Restaurants, Orders, Drivers, and Users
// tables. Each option links to the same page with a query param (?status=...)
// so filtering stays a plain server-rendered navigation — no client state needed.
// Styled as pill tab chips: active = brand fill, inactive = border ghost.
export function FilterBar({
  basePath,
  param,
  current,
  options,
}: {
  basePath: string;
  param: string;
  current: string | undefined;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const active = (current ?? "") === opt.value;
        const href = opt.value ? `${basePath}?${param}=${opt.value}` : basePath;
        return (
          <Link
            key={opt.label}
            href={href}
            className={cn(
              "rounded-full border px-3.5 py-1 text-xs font-semibold transition-colors duration-[var(--dur-fast)]",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-[0_2px_6px_rgba(255,59,92,0.3)]"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
