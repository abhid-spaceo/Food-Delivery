"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createItem, updateItem } from "@/app/(restaurant)/restaurant/menu/actions";

// Add/Edit Item modal (WIREFRAMES S12). Self-contained client component: a
// trigger button opens an overlay with the item form. The form posts to a
// Server Action (createItem | updateItem) — ownership is re-checked server-side.
// On submit we optimistically close; the page revalidates server-side.
type ItemValues = {
  id?: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  isAvailable: boolean;
};

export function ItemFormDialog({
  categoryId,
  item,
  trigger,
}: {
  categoryId: string;
  item?: ItemValues;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const isEdit = Boolean(item?.id);
  const action = isEdit ? updateItem : createItem;

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 font-semibold">{isEdit ? "Edit item" : "Add item"}</h2>
            <form action={action} className="flex flex-col gap-3">
              {isEdit && <input type="hidden" name="id" value={item!.id} />}
              {!isEdit && <input type="hidden" name="categoryId" value={categoryId} />}

              <div className="flex flex-col gap-1">
                <Label htmlFor="name">Item name</Label>
                <Input id="name" name="name" defaultValue={item?.name ?? ""} required />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="priceCents">Price (cents)</Label>
                <Input
                  id="priceCents"
                  name="priceCents"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={item?.priceCents ?? 0}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" defaultValue={item?.description ?? ""} />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input id="imageUrl" name="imageUrl" defaultValue={item?.imageUrl ?? ""} />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isAvailable"
                  defaultChecked={item?.isAvailable ?? true}
                />
                Available
              </label>

              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" onClick={() => setOpen(false)}>
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
