CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "batchId" VARCHAR(120) NOT NULL,
    "itemId" TEXT NOT NULL,
    "company" VARCHAR(255) NOT NULL,
    "currentWarehouseId" TEXT,
    "purchaseReceiptId" TEXT,
    "deliveryNoteId" TEXT,
    "stockEntryId" TEXT,
    "useBatchWiseValuation" BOOLEAN NOT NULL DEFAULT false,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "batches_batchId_key" ON "batches"("batchId");
CREATE INDEX "batches_itemId_idx" ON "batches"("itemId");
CREATE INDEX "batches_company_idx" ON "batches"("company");
CREATE INDEX "batches_currentWarehouseId_idx" ON "batches"("currentWarehouseId");
CREATE INDEX "batches_purchaseReceiptId_idx" ON "batches"("purchaseReceiptId");
CREATE INDEX "batches_deliveryNoteId_idx" ON "batches"("deliveryNoteId");
CREATE INDEX "batches_stockEntryId_idx" ON "batches"("stockEntryId");
CREATE INDEX "batches_expiryDate_idx" ON "batches"("expiryDate");
CREATE INDEX "batches_isDisabled_idx" ON "batches"("isDisabled");
CREATE INDEX "batches_quantity_idx" ON "batches"("quantity");

ALTER TABLE "batches"
    ADD CONSTRAINT "batches_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "batches"
    ADD CONSTRAINT "batches_currentWarehouseId_fkey"
    FOREIGN KEY ("currentWarehouseId") REFERENCES "warehouses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "batches"
    ADD CONSTRAINT "batches_purchaseReceiptId_fkey"
    FOREIGN KEY ("purchaseReceiptId") REFERENCES "purchase_receipts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "batches"
    ADD CONSTRAINT "batches_deliveryNoteId_fkey"
    FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "batches"
    ADD CONSTRAINT "batches_stockEntryId_fkey"
    FOREIGN KEY ("stockEntryId") REFERENCES "stock_entries"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
