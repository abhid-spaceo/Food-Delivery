import Link from "next/link";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthShellProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
}

// Branded auth layout: QwikBite logo lockup above a centered card on the
// off-white background. Wraps the sign-in / sign-up forms without touching
// their internals (labels/buttons the E2E tests query stay in the forms).
export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12">
      <Link
        href="/"
        className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-foreground transition-opacity hover:opacity-80"
      >
        <span
          className="grid size-10 place-items-center rounded-xl text-base font-extrabold text-white shadow-md"
          style={{ background: "var(--gradient-brand)" }}
        >
          QB
        </span>
        QwikBite
      </Link>
      <Card className="w-full max-w-sm shadow-[var(--shadow-card)]">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold">{title}</CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
