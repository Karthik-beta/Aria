-- CreateTable
CREATE TABLE "item_barcodes" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "barcode" VARCHAR(255) NOT NULL,
    "barcodeType" VARCHAR(100),
    "uom" VARCHAR(50),

    CONSTRAINT "item_barcodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_reorder_settings" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouse" VARCHAR(255) NOT NULL,
    "reorderLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "materialRequestType" VARCHAR(100),

    CONSTRAINT "item_reorder_settings_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "item_barcodes_itemId_idx" ON "item_barcodes"("itemId");

-- CreateIndex
CREATE INDEX "item_reorder_settings_itemId_idx" ON "item_reorder_settings"("itemId");

-- AddForeignKey
ALTER TABLE "item_barcodes" ADD CONSTRAINT "item_barcodes_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_reorder_settings" ADD CONSTRAINT "item_reorder_settings_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
