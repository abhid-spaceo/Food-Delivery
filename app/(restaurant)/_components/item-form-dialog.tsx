"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { createItem, updateItem } from "@/app/(restaurant)/restaurant/menu/actions";

// Add/Edit Item modal (WIREFRAMES S12). Rebuilt on the shared ui/dialog
// primitive for focus-trap, Esc-close, and scale-in animation.
// Public API, all form field names, and submit behavior are unchanged.
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
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogClose onClose={() => setOpen(false)} />
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
      </Dialog>
    </>
  );
}
