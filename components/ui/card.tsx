import * as React from "react";

import { cn } from "@/lib/utils";

// Pass `elevated` to opt in to the hover-lift shadow effect.
// The Card/CardHeader/CardContent/etc. API is unchanged.
function Card({
  className,
  elevated,
  ...props
}: React.ComponentProps<"div"> & { elevated?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        elevated &&
          "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-overlay)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)]",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
