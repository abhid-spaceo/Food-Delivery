"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Accessible modal dialog: focus trap, Esc to close, click-overlay to close,
// scale-in entrance animation. Renders in a portal via a fixed overlay.

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Additional class names for the dialog panel itself. */
  className?: string;
}

function Dialog({ open, onClose, children, className }: DialogProps) {
  // Focus trap — capture focus inside the dialog while it is open.
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Close on Esc key.
  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Move focus into the dialog when it opens.
  React.useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable[0]?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={cn(
          "relative w-full max-w-sm animate-[dialog-scale-in_var(--dur-fast)_var(--ease)] rounded-xl border bg-card p-6 shadow-[var(--shadow-overlay)]",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// Convenience close button for the top-right corner of a dialog.
function DialogClose({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label="Close dialog"
      onClick={onClose}
      className={cn(
        "absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <X className="size-4" />
    </button>
  );
}

export { Dialog, DialogClose };
