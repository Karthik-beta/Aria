-- CreateEnum
CREATE TYPE "StockEntryType" AS ENUM ('MATERIAL_RECEIPT', 'MATERIAL_ISSUE', 'MATERIAL_TRANSFER', 'MATERIAL_TRANSFER_FOR_MANUFACTURE', 'MANUFACTURE', 'REPACK', 'SEND_TO_SUBCONTRACTOR');

-- CreateEnum
CREATE TYPE "StockEntryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "stock_entries" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "stockEntryType" "StockEntryType" NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "company" VARCHAR(255) NOT NULL,
    "status" "StockEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "project" VARCHAR(255),
    "defaultSourceWarehouse" VARCHAR(255),
    "defaultTargetWarehouse" VARCHAR(255),
    "isOpening" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "printHeading" VARCHAR(255),
    "letterHead" VARCHAR(255),
    "inspectionRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_entry_items" (
    "id" TEXT NOT NULL,
    "stockEntryId" TEXT NOT NULL,
    "sourceWarehouse" VARCHAR(255),
    "targetWarehouse" VARCHAR(255),
    "itemCode" VARCHAR(100) NOT NULL,
    "itemName" VARCHAR(255),
    "description" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basicRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basicAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitOfMeasure" VARCHAR(50),

    CONSTRAINT "stock_entry_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_entries_series_key" ON "stock_entries"("series");

-- CreateIndex
CREATE INDEX "stock_entries_series_idx" ON "stock_entries"("series");

-- CreateIndex
CREATE INDEX "stock_entries_status_idx" ON "stock_entries"("status");

-- CreateIndex
CREATE INDEX "stock_entries_postingDate_idx" ON "stock_entries"("postingDate");

-- CreateIndex
CREATE INDEX "stock_entry_items_stockEntryId_idx" ON "stock_entry_items"("stockEntryId");

-- AddForeignKey
ALTER TABLE "stock_entry_items" ADD CONSTRAINT "stock_entry_items_stockEntryId_fkey" FOREIGN KEY ("stockEntryId") REFERENCES "stock_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
