// Deterministic seed: one admin, one approved restaurant (with owner + menu),
// and one customer. Idempotent (upserts) so it can run repeatedly.
// Run with: pnpm db:seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SEED_PASSWORD = "password123";

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: "admin@demo.test" },
    update: {},
    create: { email: "admin@demo.test", name: "Admin", role: "ADMIN", passwordHash },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@demo.test" },
    update: {},
    create: { email: "owner@demo.test", name: "Mario", role: "RESTAURANT", passwordHash },
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { ownerId: owner.id },
    update: {},
    create: {
      ownerId: owner.id,
      name: "Mario's Pizza",
      cuisine: "Pizza",
      status: "APPROVED",
      hours: "Mon–Sun 10:00–22:00",
      deliveryArea: "City center",
    },
  });

  // Only create a menu if this restaurant has none (keeps seed idempotent).
  const categoryCount = await prisma.menuCategory.count({
    where: { restaurantId: restaurant.id },
  });
  if (categoryCount === 0) {
    await prisma.menuCategory.create({
      data: {
        restaurantId: restaurant.id,
        name: "Mains",
        sortOrder: 0,
        items: {
          create: [
            { name: "Margherita", description: "Classic tomato & mozzarella", priceCents: 900 },
            { name: "Pepperoni", description: "Pepperoni & cheese", priceCents: 1100 },
          ],
        },
      },
    });
  }

  await prisma.user.upsert({
    where: { email: "customer@demo.test" },
    update: {},
    create: { email: "customer@demo.test", name: "Maya", role: "CUSTOMER", passwordHash },
  });

  console.log(
    `Seeded admin@demo.test, owner@demo.test, customer@demo.test (password: ${SEED_PASSWORD})`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
