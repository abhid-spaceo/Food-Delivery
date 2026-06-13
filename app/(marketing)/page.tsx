import Link from "next/link";

// Public landing page ("/"). Placeholder for Slice 1 — real marketing content
// and live discovery come in later slices.
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Food Delivery Platform</h1>
        <p className="text-muted-foreground">
          Customer + restaurant apps with an admin for menus and dispatch.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/browse"
          className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background"
        >
          Browse restaurants
        </Link>
        <Link
          href="/signin"
          className="rounded-md border px-5 py-2.5 text-sm font-medium"
        >
          Sign in
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        Slice 1 (Foundation) — scaffold, database, auth wiring, order state machine.
      </p>
    </main>
  );
}
