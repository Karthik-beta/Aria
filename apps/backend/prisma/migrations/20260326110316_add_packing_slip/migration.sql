-- CreateEnum
CREATE TYPE "PackingSlipStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_defaultInTransitWarehouseId_fkey";

-- DropForeignKey
ALTER TABLE "warehouses" DROP CONSTRAINT "warehouses_parentWarehouseId_fkey";

-- AlterTable
ALTER TABLE "delivery_note_items" ADD COLUMN     "packedQty" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "packing_slips" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "status" "PackingSlipStatus" NOT NULL DEFAULT 'DRAFT',
    "deliveryNoteId" TEXT NOT NULL,
    "fromCaseNo" INTEGER NOT NULL,
    "toCaseNo" INTEGER NOT NULL,
    "netWeightPkg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netWeightUom" VARCHAR(50),
    "grossWeightPkg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossWeightUom" VARCHAR(50),
    "letterHead" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packing_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_slip_items" (
    "id" TEXT NOT NULL,
    "packingSlipId" TEXT NOT NULL,
    "deliveryNoteItemId" TEXT NOT NULL,
    "itemCode" VARCHAR(100) NOT NULL,
    "itemName" VARCHAR(255),
    "description" TEXT,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weightUom" VARCHAR(50),
    "batchNo" VARCHAR(255),

    CONSTRAINT "packing_slip_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packing_slips_series_key" ON "packing_slips"("series");

-- CreateIndex
CREATE INDEX "packing_slips_deliveryNoteId_idx" ON "packing_slips"("deliveryNoteId");

-- CreateIndex
CREATE INDEX "packing_slips_status_idx" ON "packing_slips"("status");

-- CreateIndex
CREATE INDEX "packing_slip_items_packingSlipId_idx" ON "packing_slip_items"("packingSlipId");

-- CreateIndex
CREATE INDEX "packing_slip_items_deliveryNoteItemId_idx" ON "packing_slip_items"("deliveryNoteItemId");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_parentWarehouseId_fkey" FOREIGN KEY ("parentWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_defaultInTransitWarehouseId_fkey" FOREIGN KEY ("defaultInTransitWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_slips" ADD CONSTRAINT "packing_slips_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_slip_items" ADD CONSTRAINT "packing_slip_items_packingSlipId_fkey" FOREIGN KEY ("packingSlipId") REFERENCES "packing_slips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_slip_items" ADD CONSTRAINT "packing_slip_items_deliveryNoteItemId_fkey" FOREIGN KEY ("deliveryNoteItemId") REFERENCES "delivery_note_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
