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

  const customer = await prisma.user.upsert({
    where: { email: "customer@demo.test" },
    update: {},
    create: { email: "customer@demo.test", name: "Maya", role: "CUSTOMER", passwordHash },
  });

  // Approved driver (mirrors the restaurant-approval pattern).
  const driverUser = await prisma.user.upsert({
    where: { email: "driver@demo.test" },
    update: {},
    create: { email: "driver@demo.test", name: "Dev", role: "DRIVER", passwordHash },
  });
  await prisma.driver.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      name: "Dev",
      phone: "+91 90000 00000",
      status: "APPROVED",
    },
  });

  // Two PAID orders so flows are exercisable without running checkout:
  //  - one PLACED  -> the restaurant queue's "New" column / restaurant E2E
  //  - one READY (driverId=null) -> the driver pickup pool (Phase 3)
  // Idempotent: only seed orders if there are none yet.
  const DELIVERY_FEE_CENTS = 299;
  const orderCount = await prisma.order.count();
  if (orderCount === 0) {
    const placedSubtotal = 900 * 2;
    const placed = await prisma.order.create({
      data: {
        customerId: customer.id,
        restaurantId: restaurant.id,
        status: "PLACED",
        subtotalCents: placedSubtotal,
        deliveryFeeCents: DELIVERY_FEE_CENTS,
        totalCents: placedSubtotal + DELIVERY_FEE_CENTS,
        addressLine: "12 MG Road, Bengaluru",
        items: {
          create: [{ name: "Margherita", priceCents: 900, quantity: 2 }],
        },
        payment: { create: { status: "PAID" } },
        events: { create: [{ from: null, to: "PLACED", byUserId: customer.id }] },
      },
    });

    const readySubtotal = 1100;
    const ready = await prisma.order.create({
      data: {
        customerId: customer.id,
        restaurantId: restaurant.id,
        status: "READY",
        subtotalCents: readySubtotal,
        deliveryFeeCents: DELIVERY_FEE_CENTS,
        totalCents: readySubtotal + DELIVERY_FEE_CENTS,
        addressLine: "8 Brigade Road, Bengaluru",
        driverId: null,
        items: {
          create: [{ name: "Pepperoni", priceCents: 1100, quantity: 1 }],
        },
        payment: { create: { status: "PAID" } },
        events: {
          create: [
            { from: null, to: "PLACED", byUserId: customer.id },
            { from: "PLACED", to: "ACCEPTED", byUserId: owner.id },
            { from: "ACCEPTED", to: "PREPARING", byUserId: owner.id },
            { from: "PREPARING", to: "READY", byUserId: owner.id },
          ],
        },
      },
    });

    console.log(`Seeded orders: PLACED ${placed.id}, READY ${ready.id}`);
  }

  console.log(
    `Seeded admin@demo.test, owner@demo.test, customer@demo.test, driver@demo.test (password: ${SEED_PASSWORD})`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
