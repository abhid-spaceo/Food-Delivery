import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { CartButton } from "@/app/(customer)/_components/cart-button";

// Customer discovery ("/browse"). PUBLIC — login not required to browse.
// Search (name) + cuisine filter come from GET query params so the page stays a
// Server Component (no client state). Only APPROVED restaurants are visible
// (CLAUDE.md visibility rule).
export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cuisine?: string }>;
}) {
  const { q, cuisine } = await searchParams;

  const restaurants = await prisma.restaurant.findMany({
    where: {
      status: "APPROVED",
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(cuisine ? { cuisine } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, cuisine: true, deliveryArea: true },
  });

  // Distinct cuisines across APPROVED restaurants, for the filter chips.
  const cuisines = [
    ...new Set(
      (
        await prisma.restaurant.findMany({
          where: { status: "APPROVED" },
          select: { cuisine: true },
        })
      ).map((r) => r.cuisine),
    ),
  ].sort();

  return (
    <div>
      <AppHeader title="Browse">
        <CartButton />
      </AppHeader>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Browse restaurants</h1>

        {/* Search + cuisine filter (GET form). */}
        <form className="mt-4 flex flex-wrap items-end gap-2" action="/browse">
          <div className="flex-1">
            <Input name="q" defaultValue={q ?? ""} placeholder="Search by name" />
          </div>
          {cuisine ? <input type="hidden" name="cuisine" value={cuisine} /> : null}
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/browse"
            className={`rounded-full border px-3 py-1 text-sm ${!cuisine ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            All
          </Link>
          {cuisines.map((c) => (
            <Link
              key={c}
              href={`/browse?cuisine=${encodeURIComponent(c)}`}
              className={`rounded-full border px-3 py-1 text-sm ${cuisine === c ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {c}
            </Link>
          ))}
        </div>

        {/* Results grid. */}
        {restaurants.length === 0 ? (
          <p className="mt-8 rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            No restaurants match your search.
          </p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((r) => (
              <Link key={r.id} href={`/restaurants/${r.id}`} className="block">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <h2 className="font-semibold">{r.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{r.cuisine}</p>
                    {r.deliveryArea ? (
                      <p className="mt-2 text-xs text-muted-foreground">{r.deliveryArea}</p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
