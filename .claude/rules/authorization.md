# Rule: Two-layer authorization (PRD #1 risk)

The route guard (`proxy.ts` / the auth.config `authorized` callback) only checks the
caller's **role**. It does NOT prove the caller owns the data they're touching.
**Never trust the route guard alone** — this is the single biggest risk in the PRD.

## Every Server Action and data-reading page MUST re-verify ownership

Resolve the caller's own scope first, then constrain every query to it.

- Restaurant data → `requireOwnedRestaurant()` (or `getOwnedRestaurant()` in pages),
  from `app/(restaurant)/_lib/restaurant.ts`. It returns a restaurant guaranteed to
  belong to the session user, so any later `where: { restaurantId: restaurant.id }` is safe.
- Customer data → resolve `session.user.id` and scope reads/cancels to `userId`.

## Scope writes so a foreign id is a silent no-op

Use `updateMany` / `deleteMany` with the owner in the `where`, OR re-check via a
findFirst before `update`. A foreign id then matches zero rows instead of mutating
someone else's data.

```ts
// CORRECT — foreign id matches nothing, so nothing is changed
await prisma.menuItem.deleteMany({
  where: { id, category: { restaurantId: restaurant.id } },
});

// WRONG — acts on any id, even another restaurant's item
await prisma.menuItem.delete({ where: { id } });
```

For nested resources, re-check ownership through the parent chain
(e.g. item → category → restaurant), as in `restaurant/menu/actions.ts`.

See: `app/(restaurant)/restaurant/orders/[id]/actions.ts`,
`app/(restaurant)/restaurant/menu/actions.ts` for the established pattern.
