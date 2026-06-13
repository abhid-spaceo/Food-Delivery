import * as React from "react";
import { cn } from "@/lib/utils";

// Locked imagery convention: a food emoji centered on a brand-gradient
// rounded frame. Used wherever a real photo would appear — restaurant cards,
// menu thumbnails, order history, banners. Swap out for <img> later without
// changing call-sites.

interface ImageFrameProps {
  /** Food emoji to display, e.g. "🍕", "🍔". Defaults to "🍽️". */
  emoji?: string;
  /** Controls the frame's square size. */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE: Record<NonNullable<ImageFrameProps["size"]>, string> = {
  sm: "size-10 text-xl",
  md: "size-16 text-3xl",
  lg: "size-24 text-5xl",
  xl: "size-36 text-7xl",
};

function ImageFrame({ emoji = "🍽️", size = "md", className }: ImageFrameProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-2xl select-none",
        SIZE[size],
        className,
      )}
      style={{ background: "var(--gradient-brand)" }}
    >
      {emoji}
    </span>
  );
}

export { ImageFrame };
