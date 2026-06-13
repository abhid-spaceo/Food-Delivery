import * as React from "react";
import { cn } from "@/lib/utils";

// FSSAI-style veg / non-veg indicator used on menu items.
// Veg = green border + filled circle; Non-veg = red border + filled triangle.

interface VegIndicatorProps {
  isVeg: boolean;
  className?: string;
}

function VegIndicator({ isVeg, className }: VegIndicatorProps) {
  if (isVeg) {
    return (
      <span
        aria-label="Vegetarian"
        title="Vegetarian"
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-[2px] border-2 border-success",
          className,
        )}
      >
        <span className="size-2 rounded-full bg-success" />
      </span>
    );
  }

  // Non-veg: downward-pointing triangle via CSS clip-path
  return (
    <span
      aria-label="Non-vegetarian"
      title="Non-vegetarian"
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-[2px] border-2 border-destructive",
        className,
      )}
    >
      <span
        className="block size-2 bg-destructive"
        style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }}
      />
    </span>
  );
}

export { VegIndicator };
