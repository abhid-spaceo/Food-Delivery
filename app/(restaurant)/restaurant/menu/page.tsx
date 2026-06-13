import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { getOwnedRestaurant } from "@/app/(restaurant)/_lib/restaurant";
import { DashboardShell } from "@/app/(restaurant)/_components/dashboard-shell";
import { ItemFormDialog } from "@/app/(restaurant)/_components/item-form-dialog";
import { formatCents } from "@/app/(restaurant)/_lib/format";
import {
  createCategory,
  deleteCategory,
  deleteItem,
  toggleItemAvailability,
} from "@/app/(restaurant)/restaurant/menu/actions";

// Menu Manager ("/restaurant/menu"). CRUD categories + items for THIS owner only
// (WIREFRAMES S12). Reads are scoped to the owned restaurant; every mutation is
// a Server Action that re-checks ownership.
export default async function MenuPage() {
  const restaurant = await getOwnedRestaurant();
  if (!restaurant) {
    return (
      <DashboardShell title="Menu">
        <p className="text-sm text-muted-foreground">
          No restaurant is linked to this account yet.
        </p>
      </DashboardShell>
    );
  }

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { sortOrder: "asc" },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  return (
    <DashboardShell title="Menu">
      {/* Add category */}
      <form action={createCategory} className="mb-6 flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" htmlFor="new-category">
            New category
          </label>
          <Input id="new-category" name="name" placeholder="e.g. Mains" required />
        </div>
        <Button type="submit">+ Category</Button>
      </form>

      {categories.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          Add your first category to start building the menu.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {categories.map((category) => (
            <section key={category.id}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide">
                  {category.name}
                </h2>
                <div className="flex items-center gap-2">
                  <ItemFormDialog
                    categoryId={category.id}
                    trigger={
                      <Button asChild size="sm" variant="outline">
                        <span>+ Item</span>
                      </Button>
                    }
                  />
                  {/* Delete category (cascades to its items) */}
                  <form action={deleteCategory}>
                    <input type="hidden" name="id" value={category.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Delete category
                    </Button>
                  </form>
                </div>
              </div>

              <Card>
                <CardContent className="flex flex-col gap-2 p-4">
                  {category.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items yet.</p>
                  ) : (
                    category.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0"
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{item.name}</span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {formatCents(item.priceCents)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Availability toggle: posts the flipped value */}
                          <form action={toggleItemAvailability}>
                            <input type="hidden" name="id" value={item.id} />
                            <input
                              type="hidden"
                              name="isAvailable"
                              value={(!item.isAvailable).toString()}
                            />
                            <Button type="submit" size="sm" variant="outline">
                              {item.isAvailable ? "Available" : "Unavailable"}
                            </Button>
                          </form>
                          <ItemFormDialog
                            categoryId={category.id}
                            item={{
                              id: item.id,
                              name: item.name,
                              description: item.description ?? "",
                              priceCents: item.priceCents,
                              imageUrl: item.imageUrl ?? "",
                              isAvailable: item.isAvailable,
                            }}
                            trigger={
                              <Button asChild size="sm" variant="ghost">
                                <span>Edit</span>
                              </Button>
                            }
                          />
                          <form action={deleteItem}>
                            <input type="hidden" name="id" value={item.id} />
                            <Button type="submit" size="sm" variant="ghost">
                              Delete
                            </Button>
                          </form>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
