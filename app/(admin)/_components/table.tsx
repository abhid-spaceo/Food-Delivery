import * as React from "react";
import { cn } from "@/lib/utils";

// Minimal table primitives styled for the admin tables. No external table lib —
// just semantic <table> wrappers with shared spacing/border styles.
// THead is sticky so column labels stay visible when scrolling long tables.
// TBody rows alternate background (zebra) for scannability.
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-sm)]">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("sticky top-0 z-10 border-b bg-muted/60 text-left backdrop-blur-sm", className)}
      {...props}
    />
  );
}

export function TH({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y", className)} {...props} />;
}

export function TR({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "transition-colors duration-[var(--dur-fast)] hover:bg-accent/40 odd:bg-transparent even:bg-muted/20",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}
