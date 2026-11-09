-- CreateEnum
CREATE TYPE "SerialNoStatus" AS ENUM (
  'DRAFT',
  'AVAILABLE',
  'DELIVERED',
  'INSTALLED',
  'RETURNED',
  'SCRAPPED',
  'DISPOSED'
);

-- CreateEnum
CREATE TYPE "SerialNoHistoryEventType" AS ENUM (
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'WAREHOUSE_CHANGED',
  'LINKS_CHANGED'
);

-- CreateTable
CREATE TABLE "serial_nos" (
  "id" TEXT NOT NULL,
  "serialNo" VARCHAR(120) NOT NULL,
  "itemId" TEXT NOT NULL,
  "company" VARCHAR(255) NOT NULL,
  "status" "SerialNoStatus" NOT NULL DEFAULT 'DRAFT',
  "currentWarehouseId" TEXT,
  "purchaseReceiptId" TEXT,
  "deliveryNoteId" TEXT,
  "stockEntryId" TEXT,
  "pickListId" TEXT,
  "workOrder" VARCHAR(255),
  "purchaseDate" TIMESTAMP(3),
  "warrantyExpiryDate" TIMESTAMP(3),
  "serviceContractExpiryDate" TIMESTAMP(3),
  "maintenanceStatus" VARCHAR(255),
  "notes" TEXT,
  "isDisabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "serial_nos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serial_no_history" (
  "id" TEXT NOT NULL,
  "serialNoId" TEXT NOT NULL,
  "eventType" "SerialNoHistoryEventType" NOT NULL,
  "fromStatus" "SerialNoStatus",
  "toStatus" "SerialNoStatus",
  "warehouseId" TEXT,
  "transactionLabel" VARCHAR(255),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "serial_no_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "serial_nos_serialNo_key" ON "serial_nos"("serialNo");

-- CreateIndex
CREATE INDEX "serial_nos_itemId_idx" ON "serial_nos"("itemId");

-- CreateIndex
CREATE INDEX "serial_nos_company_idx" ON "serial_nos"("company");

-- CreateIndex
CREATE INDEX "serial_nos_status_idx" ON "serial_nos"("status");

-- CreateIndex
CREATE INDEX "serial_nos_currentWarehouseId_idx" ON "serial_nos"("currentWarehouseId");

-- CreateIndex
CREATE INDEX "serial_nos_purchaseReceiptId_idx" ON "serial_nos"("purchaseReceiptId");

-- CreateIndex
CREATE INDEX "serial_nos_deliveryNoteId_idx" ON "serial_nos"("deliveryNoteId");

-- CreateIndex
CREATE INDEX "serial_nos_stockEntryId_idx" ON "serial_nos"("stockEntryId");

-- CreateIndex
CREATE INDEX "serial_nos_pickListId_idx" ON "serial_nos"("pickListId");

-- CreateIndex
CREATE INDEX "serial_nos_warrantyExpiryDate_idx" ON "serial_nos"("warrantyExpiryDate");

-- CreateIndex
CREATE INDEX "serial_nos_serviceContractExpiryDate_idx" ON "serial_nos"("serviceContractExpiryDate");

-- CreateIndex
CREATE INDEX "serial_no_history_serialNoId_createdAt_idx" ON "serial_no_history"("serialNoId", "createdAt");

-- CreateIndex
CREATE INDEX "serial_no_history_eventType_idx" ON "serial_no_history"("eventType");

-- AddForeignKey
ALTER TABLE "serial_nos"
ADD CONSTRAINT "serial_nos_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_nos"
ADD CONSTRAINT "serial_nos_currentWarehouseId_fkey"
FOREIGN KEY ("currentWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_nos"
ADD CONSTRAINT "serial_nos_purchaseReceiptId_fkey"
FOREIGN KEY ("purchaseReceiptId") REFERENCES "purchase_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_nos"
ADD CONSTRAINT "serial_nos_deliveryNoteId_fkey"
FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_nos"
ADD CONSTRAINT "serial_nos_stockEntryId_fkey"
FOREIGN KEY ("stockEntryId") REFERENCES "stock_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_nos"
ADD CONSTRAINT "serial_nos_pickListId_fkey"
FOREIGN KEY ("pickListId") REFERENCES "pick_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_no_history"
ADD CONSTRAINT "serial_no_history_serialNoId_fkey"
FOREIGN KEY ("serialNoId") REFERENCES "serial_nos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "serial_no_history"
ADD CONSTRAINT "serial_no_history_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
