-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "hasVariants" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isFixedAsset" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isZeroRated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "openingStock" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "standardSellingRate" DOUBLE PRECISION,
ADD COLUMN     "taxCode" VARCHAR(50),
ADD COLUMN     "valuationRate" DOUBLE PRECISION,
ALTER COLUMN "maintainStock" SET DEFAULT true;
