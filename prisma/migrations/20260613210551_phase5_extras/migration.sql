-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "isOnline" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "isVeg" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "prepMinutes" INTEGER;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "isAcceptingOrders" BOOLEAN NOT NULL DEFAULT true;
