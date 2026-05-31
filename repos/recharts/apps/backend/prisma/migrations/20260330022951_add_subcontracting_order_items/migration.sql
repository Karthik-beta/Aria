-- CreateTable
CREATE TABLE "subcontracting_order_items" (
    "id" TEXT NOT NULL,
    "subcontractingOrderId" TEXT NOT NULL,
    "itemCode" VARCHAR(100) NOT NULL,
    "itemName" VARCHAR(255),
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "subcontracting_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subcontracting_order_items_subcontractingOrderId_idx" ON "subcontracting_order_items"("subcontractingOrderId");

-- CreateIndex
CREATE INDEX "subcontracting_order_items_itemCode_idx" ON "subcontracting_order_items"("itemCode");

-- AddForeignKey
ALTER TABLE "subcontracting_order_items" ADD CONSTRAINT "subcontracting_order_items_subcontractingOrderId_fkey" FOREIGN KEY ("subcontractingOrderId") REFERENCES "subcontracting_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
