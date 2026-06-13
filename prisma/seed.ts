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
    // Reset mutable fields a test may flip, so reseeding is deterministic.
    update: { status: "APPROVED", isAcceptingOrders: true },
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
            { name: "Margherita", description: "Classic tomato & mozzarella", priceCents: 900, isVeg: true },
            { name: "Pepperoni", description: "Pepperoni & cheese", priceCents: 1100, isVeg: false },
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
    update: { isOnline: true },
    create: {
      userId: driverUser.id,
      name: "Dev",
      phone: "+91 90000 00000",
      status: "APPROVED",
      isOnline: true,
    },
  });

  // Second approved driver — for the atomic-claim "already claimed" E2E.
  const driverUser2 = await prisma.user.upsert({
    where: { email: "driver2@demo.test" },
    update: {},
    create: { email: "driver2@demo.test", name: "Dani", role: "DRIVER", passwordHash },
  });
  await prisma.driver.upsert({
    where: { userId: driverUser2.id },
    update: { isOnline: true },
    create: { userId: driverUser2.id, name: "Dani", phone: "+91 90000 00001", status: "APPROVED", isOnline: true },
  });

  const DELIVERY_FEE_CENTS = 299;

  // --- Second restaurant (Spice Hub) + owner ---
  const owner2 = await prisma.user.upsert({
    where: { email: "owner2@demo.test" },
    update: {},
    create: { email: "owner2@demo.test", name: "Sole", role: "RESTAURANT", passwordHash },
  });
  const restaurant2 = await prisma.restaurant.upsert({
    where: { ownerId: owner2.id },
    update: { status: "APPROVED", isAcceptingOrders: true },
    create: { ownerId: owner2.id, name: "Spice Hub", cuisine: "Indian", status: "APPROVED", hours: "Mon–Sun 11:00–23:00", deliveryArea: "Downtown" },
  });
  const cat2 = await prisma.menuCategory.count({ where: { restaurantId: restaurant2.id } });
  if (cat2 === 0) {
    await prisma.menuCategory.create({
      data: { restaurantId: restaurant2.id, name: "Curries", sortOrder: 0,
        items: { create: [{ name: "Paneer Butter Masala", description: "Creamy tomato", priceCents: 1200, isVeg: true }] } },
    });
  }

  // Ensure Mario's has at least 3 PAID PLACED orders (accept + reject consume
  // two; one remains for read-only tests; top-up makes the suite re-runnable).
  const marioPlaced = await prisma.order.count({
    where: { restaurantId: restaurant.id, status: "PLACED", payment: { status: "PAID" } },
  });
  for (let i = marioPlaced; i < 3; i++) {
    const sub = 900 * 2;
    await prisma.order.create({ data: {
      customerId: customer.id, restaurantId: restaurant.id, status: "PLACED",
      subtotalCents: sub, deliveryFeeCents: DELIVERY_FEE_CENTS, totalCents: sub + DELIVERY_FEE_CENTS,
      addressLine: "12 MG Road, Bengaluru",
      items: { create: [{ name: "Margherita", priceCents: 900, quantity: 2 }] },
      payment: { create: { status: "PAID" } },
      events: { create: [{ from: null, to: "PLACED", byUserId: customer.id }] },
    }});
  }

  // Ensure at least 2 PAID, unclaimed READY orders (Phase 3 driver pool).
  // Two are needed so the happy-path test and the already-claimed test each
  // have their own order to consume without contending. Idempotent: only
  // creates as many as are missing (re-running never exceeds 2 / no dup-keys).
  const readyCount = await prisma.order.count({
    where: { status: "READY", driverId: null },
  });
  for (let i = readyCount; i < 2; i++) {
    const readySubtotal = 1100;
    await prisma.order.create({
      data: {
        customerId: customer.id,
        restaurantId: restaurant.id,
        status: "READY",
        subtotalCents: readySubtotal,
        deliveryFeeCents: DELIVERY_FEE_CENTS,
        totalCents: readySubtotal + DELIVERY_FEE_CENTS,
        addressLine: "8 Brigade Road, Bengaluru",
        driverId: null,
        items: { create: [{ name: "Pepperoni", priceCents: 1100, quantity: 1 }] },
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
  }

  // Spice Hub: ensure at least 1 PAID PLACED order (cross-tenant isolation test).
  const spicePlaced = await prisma.order.count({
    where: { restaurantId: restaurant2.id, status: "PLACED", payment: { status: "PAID" } },
  });
  if (spicePlaced === 0) {
    const sub = 1200;
    await prisma.order.create({ data: {
      customerId: customer.id, restaurantId: restaurant2.id, status: "PLACED",
      subtotalCents: sub, deliveryFeeCents: DELIVERY_FEE_CENTS, totalCents: sub + DELIVERY_FEE_CENTS,
      addressLine: "5 Curry Street, Bengaluru",
      items: { create: [{ name: "Paneer Butter Masala", priceCents: 1200, quantity: 1 }] },
      payment: { create: { status: "PAID" } },
      events: { create: [{ from: null, to: "PLACED", byUserId: customer.id }] },
    }});
  }

  // Unpaid PLACED order for Mario's with sentinel total $77.77 (payment-gate
  // test: this order must NEVER appear in the restaurant queue).
  const SENTINEL = 7777;
  const unpaid = await prisma.order.count({
    where: { restaurantId: restaurant.id, totalCents: SENTINEL, payment: { status: "PENDING" } },
  });
  if (unpaid === 0) {
    await prisma.order.create({ data: {
      customerId: customer.id, restaurantId: restaurant.id, status: "PLACED",
      subtotalCents: SENTINEL, deliveryFeeCents: 0, totalCents: SENTINEL,
      addressLine: "99 Unpaid Lane, Bengaluru",
      items: { create: [{ name: "Unpaid Test Pizza", priceCents: SENTINEL, quantity: 1 }] },
      payment: { create: { status: "PENDING" } },
      events: { create: [{ from: null, to: "PLACED", byUserId: customer.id }] },
    }});
  }

  console.log(
    `Seeded admin@demo.test, owner@demo.test, owner2@demo.test, customer@demo.test, driver@demo.test, driver2@demo.test (password: ${SEED_PASSWORD})`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
