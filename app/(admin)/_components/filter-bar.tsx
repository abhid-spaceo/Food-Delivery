import Link from "next/link";
import { cn } from "@/lib/utils";

// Link-based filter row used by the Restaurants and Orders tables. Each option
// links to the same page with a query param (?status=...) so filtering stays a
// plain server-rendered navigation — no client state needed.
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
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Filter:</span>
      {options.map((opt) => {
        const active = (current ?? "") === opt.value;
        const href = opt.value ? `${basePath}?${param}=${opt.value}` : basePath;
        return (
          <Link
            key={opt.label}
            href={href}
            className={cn(
              "rounded-md border px-3 py-1 transition-colors",
              active
                ? "border-transparent bg-primary text-primary-foreground"
                : "hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
