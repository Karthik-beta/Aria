-- AlterTable
ALTER TABLE "inventory_items"
ADD COLUMN "shelfLifeInDays" INTEGER,
ADD COLUMN "warrantyPeriodInDays" INTEGER,
ADD COLUMN "endOfLife" TIMESTAMP(3),
ADD COLUMN "weightPerUnit" DOUBLE PRECISION,
ADD COLUMN "weightUom" VARCHAR(50),
ADD COLUMN "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "valuationMethod" VARCHAR(50),
ADD COLUMN "defaultMaterialRequestType" VARCHAR(50),
ADD COLUMN "hasBatchNo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "hasSerialNo" BOOLEAN NOT NULL DEFAULT false;
