-- AlterTable
ALTER TABLE "asset_categories" ADD COLUMN     "dailyProrataBased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expectedValueAfterUsefulLife" DECIMAL(18,6),
ADD COLUMN     "rateOfDepreciation" DOUBLE PRECISION,
ADD COLUMN     "shiftBased" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "asset_depreciation_schedules" ADD COLUMN     "dailyProrataBased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expectedValueAfterUsefulLife" DECIMAL(18,6),
ADD COLUMN     "rateOfDepreciation" DOUBLE PRECISION,
ADD COLUMN     "shiftBased" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "item_uom_conversions" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "uomId" TEXT NOT NULL,
    "conversionFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "item_uom_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_activity_logs" (
    "id" TEXT NOT NULL,
    "itemId" VARCHAR(100) NOT NULL,
    "activityType" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DOUBLE PRECISION,
    "value" DOUBLE PRECISION,
    "company" VARCHAR(255),
    "warehouse" VARCHAR(255),
    "referenceType" VARCHAR(50),
    "referenceId" VARCHAR(100),
    "referenceName" VARCHAR(255),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_uom_conversions_itemId_idx" ON "item_uom_conversions"("itemId");

-- CreateIndex
CREATE INDEX "item_uom_conversions_uomId_idx" ON "item_uom_conversions"("uomId");

-- CreateIndex
CREATE UNIQUE INDEX "item_uom_conversions_itemId_uomId_key" ON "item_uom_conversions"("itemId", "uomId");

-- CreateIndex
CREATE INDEX "item_activity_logs_itemId_idx" ON "item_activity_logs"("itemId");

-- CreateIndex
CREATE INDEX "item_activity_logs_createdAt_idx" ON "item_activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "item_activity_logs_itemId_createdAt_idx" ON "item_activity_logs"("itemId", "createdAt");

-- AddForeignKey
ALTER TABLE "item_uom_conversions" ADD CONSTRAINT "item_uom_conversions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_uom_conversions" ADD CONSTRAINT "item_uom_conversions_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "UnitOfMeasurement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
