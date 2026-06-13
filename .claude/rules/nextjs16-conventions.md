# Rule: Next.js 16 conventions (this is not the Next.js you know)

APIs and file names changed in Next.js 16. Read the relevant guide in
`node_modules/next/dist/docs/` before assuming an older pattern. See `AGENTS.md`.

## Route protection lives in `proxy.ts`, not `middleware.ts`

The role-based route guard is `proxy.ts` at the repo root (paired with the
auth.config `authorized` callback). There is no `middleware.ts`. Do not create one
or move the guard there.

> The guard is role-only. Ownership is re-verified in each Server Action — see
> `.claude/rules/authorization.md`.

## Mutations are Server Actions; Route Handlers are the exception

- Mutations → `"use server"` actions (e.g. `restaurant/menu/actions.ts`), each ending
  with `revalidatePath(...)` so pages re-render.
- Route Handlers (`route.ts`) only for: the Stripe webhook, and JSON the SWR polling
  hooks consume (e.g. `restaurant/orders/queue/route.ts`).
- JSON endpoints use the envelope `{ ok, data, error }`.
- Server Components by default; client components only where interaction needs them.
