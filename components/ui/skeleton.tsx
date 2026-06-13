import * as React from "react";
import { cn } from "@/lib/utils";

// Shimmer loading placeholder. Drop-in replacement for content while data loads.
// Usage: <Skeleton className="h-4 w-32" /> — size it to match the content it replaces.

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-secondary",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
