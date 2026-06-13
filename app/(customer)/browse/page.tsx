import { AppHeader } from "@/components/app-header";

// Customer discovery ("/browse"). Public — login not required to browse.
// Placeholder — live restaurant grid + search arrive in the customer slice.
export default function BrowsePage() {
  return (
    <div>
      <AppHeader title="Food Delivery" />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold">Browse restaurants</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Discovery placeholder. Approved restaurants, search, and cuisine filters land here.
        </p>
      </main>
    </div>
  );
}
