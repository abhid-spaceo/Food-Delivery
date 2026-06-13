// app/(customer)/restaurants/[id]/page.tsx
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { formatCents } from "@/app/(customer)/_lib/format";
import { CartButton } from "@/app/(customer)/_components/cart-button";
import { AddToCartButton } from "@/app/(customer)/_components/add-to-cart-button";

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

  return (
    <div>
      <AppHeader title={restaurant.name}>
        <CartButton />
      </AppHeader>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {restaurant.cuisine}
          {restaurant.hours ? ` · ${restaurant.hours}` : ""}
        </p>

        {restaurant.categories.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">No menu yet.</p>
        ) : (
          restaurant.categories.map((cat) => (
            <section key={cat.id} className="mt-8">
              <h2 className="mb-3 text-lg font-semibold">{cat.name}</h2>
              {cat.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing available here right now.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {cat.items.map((it) => (
                    <Card key={it.id}>
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div>
                          <p className="font-medium">{it.name}</p>
                          {it.description ? (
                            <p className="text-sm text-muted-foreground">{it.description}</p>
                          ) : null}
                          <p className="mt-1 text-sm font-semibold">{formatCents(it.priceCents)}</p>
                        </div>
                        <AddToCartButton
                          restaurant={ref}
                          item={{ menuItemId: it.id, name: it.name, priceCents: it.priceCents }}
                        />
                      </CardContent>
                    </Card>
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
