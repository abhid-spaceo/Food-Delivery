import * as React from "react";
import { cn } from "@/lib/utils";

// Branded empty / error block. Shows an icon (or emoji), a message, and an
// optional action button. Use on any data screen when the list is empty or
// a fetch fails.

interface EmptyStateProps {
  /** Icon component from lucide-react, an emoji string, or any ReactNode. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Optional call-to-action rendered below the message. */
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center",
        className,
      )}
    >
      {icon && (
        <span className="text-3xl text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
      )}
      <p className="font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export { EmptyState };
