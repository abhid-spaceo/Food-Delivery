import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageFrame } from "@/components/ui/image-frame";
import { EmptyState } from "@/components/ui/empty-state";
import { prisma } from "@/lib/db";
import { CartButton } from "@/app/(customer)/_components/cart-button";

// Emoji map for cuisine types — keeps the imagery convention (gradient-mesh + emoji).
const CUISINE_EMOJI: Record<string, string> = {
  Pizza: "🍕",
  Biryani: "🍛",
  "North Indian": "🥘",
  Chinese: "🍜",
  Healthy: "🥗",
  Burger: "🍔",
  Sushi: "🍱",
  Italian: "🍝",
  Mexican: "🌮",
  Thai: "🍜",
  Cafe: "☕",
};

function restaurantEmoji(cuisine: string): string {
  return CUISINE_EMOJI[cuisine] ?? "🍽️";
}

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

      {/* Sticky hero band with search */}
      <div className="sticky top-[57px] z-30 border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-3">
          {/* Search + cuisine filter (GET form) — kept exactly as is for E2E */}
          <form className="flex flex-wrap items-center gap-2" action="/browse">
            <div className="flex-1 min-w-[180px]">
              <Input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search restaurants…"
                className="h-9 rounded-full border-border/70 bg-card shadow-[var(--shadow-sm)]"
              />
            </div>
            {cuisine ? <input type="hidden" name="cuisine" value={cuisine} /> : null}
            <Button type="submit" variant="outline" size="sm" className="rounded-full">
              Search
            </Button>
          </form>

          {/* Cuisine chip rail */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Link
              href="/browse"
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                !cuisine
                  ? "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(255,59,92,0.3)]"
                  : "border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              All
            </Link>
            {cuisines.map((c) => (
              <Link
                key={c}
                href={`/browse?cuisine=${encodeURIComponent(c)}`}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  cuisine === c
                    ? "bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(255,59,92,0.3)]"
                    : "border border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {CUISINE_EMOJI[c] ? `${CUISINE_EMOJI[c]} ` : ""}{c}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-xl font-semibold text-foreground">
          {cuisine ? `${cuisine} restaurants` : "Browse restaurants"}
        </h1>
        {q && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Results for &ldquo;{q}&rdquo;
          </p>
        )}

        {/* Results grid */}
        {restaurants.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No restaurants found"
            description={
              q || cuisine
                ? "Try a different search or browse all cuisines."
                : "No approved restaurants available yet."
            }
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/browse">Clear filters</Link>
              </Button>
            }
            className="mt-8"
          />
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((r) => (
              // E2E: getByRole("link", { name: r.name }) — the card is the link
              <Link key={r.id} href={`/restaurants/${r.id}`} className="block group">
                <Card
                  elevated
                  className="h-full overflow-hidden"
                >
                  {/* Image slot — gradient mesh + cuisine emoji */}
                  <div className="relative flex h-[148px] items-center justify-center overflow-hidden bg-secondary">
                    <ImageFrame
                      emoji={restaurantEmoji(r.cuisine)}
                      size="xl"
                      className="rounded-none rounded-tl-xl rounded-tr-xl opacity-90 transition-transform duration-[var(--dur)] ease-[var(--ease)] group-hover:scale-105"
                    />
                  </div>
                  <CardContent className="p-4">
                    <h2 className="font-semibold text-foreground leading-tight">{r.name}</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">{r.cuisine}</p>
                    {r.deliveryArea ? (
                      <p className="mt-2 text-xs text-muted-foreground truncate">{r.deliveryArea}</p>
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
