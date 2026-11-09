-- CreateEnum
CREATE TYPE "SubcontractingOrderStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "subcontracting_orders" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier" VARCHAR(255) NOT NULL,
    "company" VARCHAR(255) NOT NULL,
    "status" "SubcontractingOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "percentReceived" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subcontracting_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontracting_order_supplied_items" (
    "id" TEXT NOT NULL,
    "subcontractingOrderId" TEXT NOT NULL,
    "rmItemCode" VARCHAR(100) NOT NULL,
    "rmItemName" VARCHAR(255),
    "requiredQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suppliedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "subcontracting_order_supplied_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subcontracting_orders_series_key" ON "subcontracting_orders"("series");

-- CreateIndex
CREATE INDEX "subcontracting_orders_status_idx" ON "subcontracting_orders"("status");

-- CreateIndex
CREATE INDEX "subcontracting_orders_transactionDate_idx" ON "subcontracting_orders"("transactionDate");

-- CreateIndex
CREATE INDEX "subcontracting_orders_supplier_idx" ON "subcontracting_orders"("supplier");

-- CreateIndex
CREATE INDEX "subcontracting_orders_company_idx" ON "subcontracting_orders"("company");

-- CreateIndex
CREATE INDEX "subcontracting_order_supplied_items_subcontractingOrderId_idx" ON "subcontracting_order_supplied_items"("subcontractingOrderId");

-- CreateIndex
CREATE INDEX "subcontracting_order_supplied_items_rmItemCode_idx" ON "subcontracting_order_supplied_items"("rmItemCode");

-- AddForeignKey
ALTER TABLE "subcontracting_order_supplied_items" ADD CONSTRAINT "subcontracting_order_supplied_items_subcontractingOrderId_fkey" FOREIGN KEY ("subcontractingOrderId") REFERENCES "subcontracting_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
