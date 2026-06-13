import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Vertical dot-and-line status tracker used for order tracking timelines.
// Each step can be "done", "current", or "pending".

type TimelineStepState = "done" | "current" | "pending";

interface TimelineStep {
  label: string;
  /** Sub-label / timestamp or note shown below the main label. */
  description?: string;
  state: TimelineStepState;
}

interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

function Timeline({ steps, className }: TimelineProps) {
  return (
    <ol
      aria-label="Order timeline"
      className={cn("flex flex-col", className)}
    >
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={i} className="flex gap-3">
            {/* Dot + connector line column */}
            <div className="flex flex-col items-center">
              <TimelineDot state={step.state} />
              {!isLast && (
                <div
                  className={cn(
                    "my-0.5 w-px flex-1",
                    step.state === "done" ? "bg-success" : "bg-border",
                  )}
                />
              )}
            </div>
            {/* Label column */}
            <div className={cn("pb-4", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium leading-none",
                  step.state === "pending" && "text-muted-foreground",
                  step.state === "current" && "text-foreground",
                  step.state === "done" && "text-foreground",
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {step.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TimelineDot({ state }: { state: TimelineStepState }) {
  if (state === "done") {
    return (
      <span
        aria-label="Completed"
        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success"
      >
        <Check className="size-3 text-white" strokeWidth={3} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        aria-label="In progress"
        className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary-foreground"
      >
        <span className="size-2 rounded-full bg-primary" />
      </span>
    );
  }
  // pending
  return (
    <span
      aria-label="Pending"
      className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background"
    />
  );
}

export { Timeline };
export type { TimelineStep, TimelineStepState };
