"use client";

import { useTransition } from "react";
import { setDriverOnline } from "@/app/(driver)/_lib/actions";

// Real online/offline toggle pill for the driver shell.
// Calls the setDriverOnline server action and shows a pending state.
export function OnlineToggle({ isOnline }: { isOnline: boolean }) {
  const [pending, start] = useTransition();

  function toggle() {
    start(() => setDriverOnline(!isOnline));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        isOnline
          ? "border-[var(--success)] bg-[var(--success-soft)] text-[var(--success)]"
          : "border-border bg-secondary text-muted-foreground hover:bg-accent"
      }`}
    >
      <span
        className={`size-2 rounded-full ${isOnline ? "bg-[var(--success)]" : "bg-muted-foreground"}`}
        aria-hidden="true"
      />
      {pending ? "…" : isOnline ? "Online" : "Offline"}
    </button>
  );
}
