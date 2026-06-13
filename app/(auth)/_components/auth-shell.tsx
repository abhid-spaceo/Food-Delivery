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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-12">
      <Link
        href="/"
        className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground"
      >
        <span className="grid size-9 place-items-center rounded-xl bg-primary text-base font-bold text-primary-foreground">
          QB
        </span>
        QwikBite
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  );
}
