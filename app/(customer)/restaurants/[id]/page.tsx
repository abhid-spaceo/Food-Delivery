// app/(customer)/restaurants/[id]/page.tsx
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ImageFrame } from "@/components/ui/image-frame";
import { VegIndicator } from "@/components/ui/veg-indicator";
import { prisma } from "@/lib/db";
import { formatCents } from "@/app/(customer)/_lib/format";
import { CartButton } from "@/app/(customer)/_components/cart-button";
import { AddToCartButton } from "@/app/(customer)/_components/add-to-cart-button";

// Emoji map for cuisine types — imagery convention (gradient-mesh + emoji).
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

// Restaurant detail ("/restaurants/[id]"). PUBLIC, but APPROVED-gated: a
// non-approved or unknown id 404s (no info leak). Menu grouped by category;
// only AVAILABLE items can be added.
export default async function RestaurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const restaurant = await prisma.restaurant.findFirst({
    where: { id, status: "APPROVED" },
    select: {
      id: true,
      name: true,
      cuisine: true,
      hours: true,
      categories: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          items: {
            where: { isAvailable: true },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, description: true, priceCents: true },
          },
        },
      },
    },
  });

  if (!restaurant) notFound();

  const ref = { id: restaurant.id, name: restaurant.name };
  const bannerEmoji = CUISINE_EMOJI[restaurant.cuisine] ?? "🍽️";

  return (
    <div>
      <AppHeader title={restaurant.name}>
        <CartButton />
      </AppHeader>

      {/* Banner — gradient ImageFrame as hero */}
      <div
        className="relative flex h-40 items-center justify-center overflow-hidden"
        style={{ background: "var(--gradient-brand)" }}
      >
        <span className="text-8xl select-none" aria-hidden="true">
          {bannerEmoji}
        </span>
        {/* Gradient overlay so text below reads clearly */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent" />
      </div>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-start gap-4">
          <ImageFrame emoji={bannerEmoji} size="md" className="shrink-0 -mt-10 ring-4 ring-background" />
          <div>
            <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {restaurant.cuisine}
              {restaurant.hours ? ` · ${restaurant.hours}` : ""}
            </p>
          </div>
        </div>

        {restaurant.categories.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">No menu yet.</p>
        ) : (
          restaurant.categories.map((cat) => (
            <section key={cat.id} className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">{cat.name}</h2>
              {cat.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing available here right now.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border rounded-xl border bg-card overflow-hidden">
                  {cat.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-4 p-4 hover:bg-accent/40 transition-colors">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* VegIndicator — visual only, no E2E dependency on it */}
                        <VegIndicator isVeg={true} className="mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{it.name}</p>
                          {it.description ? (
                            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{it.description}</p>
                          ) : null}
                          <p className="mt-1 text-sm font-semibold text-foreground">{formatCents(it.priceCents)}</p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <AddToCartButton
                          restaurant={ref}
                          item={{ menuItemId: it.id, name: it.name, priceCents: it.priceCents }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
