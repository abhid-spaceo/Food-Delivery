import * as React from "react";
import { cn } from "@/lib/utils";

// Minimal table primitives styled for the admin tables. No external table lib —
// just semantic <table> wrappers with shared spacing/border styles.
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("border-b bg-muted/50 text-left", className)} {...props} />;
}

export function TH({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th className={cn("px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)} {...props} />
  );
}

export function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("divide-y", className)} {...props} />;
}

export function TR({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-muted/50", className)} {...props} />;
}

export function TD({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-2 align-middle", className)} {...props} />;
}
