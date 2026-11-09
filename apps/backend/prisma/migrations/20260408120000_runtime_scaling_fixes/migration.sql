-- CreateTable
CREATE TABLE "document_series_counters" (
    "key" VARCHAR(160) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_series_counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "inventory_items_maintainStock_disabled_idx" ON "inventory_items"("maintainStock", "disabled");

-- CreateIndex
CREATE INDEX "item_reorder_settings_warehouse_idx" ON "item_reorder_settings"("warehouse");

-- CreateIndex
CREATE INDEX "item_reorder_settings_itemId_warehouse_idx" ON "item_reorder_settings"("itemId", "warehouse");

-- CreateIndex
CREATE INDEX "material_requests_company_status_transactionDate_idx" ON "material_requests"("company", "status", "transactionDate");

-- CreateIndex
CREATE INDEX "material_requests_company_purpose_status_transactionDate_idx" ON "material_requests"("company", "purpose", "status", "transactionDate");

-- CreateIndex
CREATE INDEX "material_request_items_itemCode_idx" ON "material_request_items"("itemCode");

-- CreateIndex
CREATE INDEX "material_request_items_targetWarehouse_idx" ON "material_request_items"("targetWarehouse");

-- CreateIndex
CREATE INDEX "material_request_items_itemCode_materialRequestId_idx" ON "material_request_items"("itemCode", "materialRequestId");

-- CreateIndex
CREATE INDEX "stock_entries_company_status_postingDate_createdAt_idx" ON "stock_entries"("company", "status", "postingDate", "createdAt");

-- CreateIndex
CREATE INDEX "stock_entries_company_stockEntryType_status_postingDate_idx" ON "stock_entries"("company", "stockEntryType", "status", "postingDate");

-- CreateIndex
CREATE INDEX "stock_entry_items_itemCode_idx" ON "stock_entry_items"("itemCode");

-- CreateIndex
CREATE INDEX "stock_entry_items_itemCode_stockEntryId_idx" ON "stock_entry_items"("itemCode", "stockEntryId");

-- CreateIndex
CREATE INDEX "stock_entry_items_sourceWarehouse_idx" ON "stock_entry_items"("sourceWarehouse");

-- CreateIndex
CREATE INDEX "stock_entry_items_sourceWarehouse_stockEntryId_idx" ON "stock_entry_items"("sourceWarehouse", "stockEntryId");

-- CreateIndex
CREATE INDEX "stock_entry_items_targetWarehouse_idx" ON "stock_entry_items"("targetWarehouse");

-- CreateIndex
CREATE INDEX "stock_entry_items_targetWarehouse_stockEntryId_idx" ON "stock_entry_items"("targetWarehouse", "stockEntryId");

-- CreateIndex
CREATE INDEX "delivery_notes_company_status_isReturn_postingDate_idx" ON "delivery_notes"("company", "status", "isReturn", "postingDate");

-- CreateIndex
CREATE INDEX "delivery_notes_company_customer_postingDate_idx" ON "delivery_notes"("company", "customer", "postingDate");

-- CreateIndex
CREATE INDEX "delivery_note_items_itemCode_idx" ON "delivery_note_items"("itemCode");

-- CreateIndex
CREATE INDEX "delivery_note_items_itemCode_deliveryNoteId_idx" ON "delivery_note_items"("itemCode", "deliveryNoteId");

-- CreateIndex
CREATE INDEX "delivery_note_items_warehouse_idx" ON "delivery_note_items"("warehouse");

-- CreateIndex
CREATE INDEX "delivery_note_items_warehouse_deliveryNoteId_idx" ON "delivery_note_items"("warehouse", "deliveryNoteId");

-- CreateIndex
CREATE INDEX "purchase_receipts_company_status_isReturn_postingDate_idx" ON "purchase_receipts"("company", "status", "isReturn", "postingDate");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_itemCode_idx" ON "purchase_receipt_items"("itemCode");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_itemCode_purchaseReceiptId_idx" ON "purchase_receipt_items"("itemCode", "purchaseReceiptId");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_acceptedWarehouse_idx" ON "purchase_receipt_items"("acceptedWarehouse");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_rejectedWarehouse_idx" ON "purchase_receipt_items"("rejectedWarehouse");

-- CreateIndex
CREATE INDEX "pick_lists_company_status_purpose_updatedAt_idx" ON "pick_lists"("company", "status", "purpose", "updatedAt");

-- CreateIndex
CREATE INDEX "pick_lists_company_warehouse_idx" ON "pick_lists"("company", "warehouse");

-- CreateIndex
CREATE INDEX "pick_list_items_item_idx" ON "pick_list_items"("item");

-- CreateIndex
CREATE INDEX "pick_list_items_item_pickListId_idx" ON "pick_list_items"("item", "pickListId");

-- CreateIndex
CREATE INDEX "pick_list_items_warehouse_idx" ON "pick_list_items"("warehouse");

-- CreateIndex
CREATE INDEX "pick_list_items_warehouse_pickListId_idx" ON "pick_list_items"("warehouse", "pickListId");
