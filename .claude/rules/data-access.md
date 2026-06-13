# Rule: Prisma client access (gotcha)

This project generates the Prisma client into the repo, not `node_modules`.
Default instinct (`@prisma/client`) is WRONG here and will not compile.

## Import the client and types from the generated path

```ts
// CORRECT
import { PrismaClient } from "@/lib/generated/prisma/client";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

// WRONG — this package is not what the code uses
import { PrismaClient } from "@prisma/client";
```

## Always use the shared singleton — never construct a client

Import the ready-made instance from `@/lib/db`. Constructing `new PrismaClient()`
ad hoc breaks the dev hot-reload singleton and the pg driver-adapter setup.

```ts
// CORRECT
import { prisma } from "@/lib/db";

// WRONG
const prisma = new PrismaClient();
```

Note: Prisma 7 connects via the `pg` driver adapter (see `lib/db.ts`); the client
does not read `DATABASE_URL` itself — `lib/db.ts` validates it at startup.
