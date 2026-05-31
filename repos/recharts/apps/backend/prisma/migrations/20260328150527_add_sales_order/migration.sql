-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'TO_DELIVER_AND_BILL', 'TO_DELIVER', 'TO_BILL', 'COMPLETED', 'CLOSED');

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer" VARCHAR(255) NOT NULL,
    "company" VARCHAR(255) NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_items" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "itemCode" VARCHAR(100) NOT NULL,
    "itemName" VARCHAR(255),
    "description" TEXT,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveredQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warehouse" VARCHAR(255),
    "lastDeliveryDate" TIMESTAMP(3),

    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_series_key" ON "sales_orders"("series");

-- CreateIndex
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");

-- CreateIndex
CREATE INDEX "sales_orders_transactionDate_idx" ON "sales_orders"("transactionDate");

-- CreateIndex
CREATE INDEX "sales_orders_customer_idx" ON "sales_orders"("customer");

-- CreateIndex
CREATE INDEX "sales_orders_company_idx" ON "sales_orders"("company");

-- CreateIndex
CREATE INDEX "sales_order_items_salesOrderId_idx" ON "sales_order_items"("salesOrderId");

-- CreateIndex
CREATE INDEX "sales_order_items_itemCode_idx" ON "sales_order_items"("itemCode");

-- AddForeignKey
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
