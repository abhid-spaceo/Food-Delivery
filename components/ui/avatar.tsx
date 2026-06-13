import * as React from "react";
import { cn } from "@/lib/utils";

// Emoji/initials avatar with an optional gradient ring.
// Used for user profiles, driver cards, and customer headers.

interface AvatarProps {
  /** Emoji or short initials to display, e.g. "👤" or "AB". */
  label: string;
  /** Size variant controlling the circle diameter. */
  size?: "sm" | "md" | "lg";
  /** When true, adds the brand-gradient ring around the avatar. */
  ring?: boolean;
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-14 text-xl",
};

function Avatar({ label, size = "md", ring = false, className }: AvatarProps) {
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-dark select-none",
        SIZE[size],
        // Gradient ring: a thin gradient border via a wrapper outline approach.
        // We use a box-shadow with the primary brand color as a close-enough
        // approximation (true gradient rings need a wrapper element or mask).
        ring && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        className,
      )}
    >
      {label}
    </span>
  );
}

export { Avatar };
