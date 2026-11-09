-- CreateEnum
CREATE TYPE "MaterialRequestPurpose" AS ENUM ('PURCHASE', 'MANUFACTURE', 'MATERIAL_TRANSFER', 'MATERIAL_ISSUE', 'CUSTOMER_PROVIDED');

-- CreateEnum
CREATE TYPE "MaterialRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'PARTIALLY_ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- DropIndex
DROP INDEX "item_manufacturers_itemId_default_unique";

-- CreateTable
CREATE TABLE "material_requests" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purpose" "MaterialRequestPurpose" NOT NULL DEFAULT 'PURCHASE',
    "company" VARCHAR(255) NOT NULL,
    "requiredBy" TIMESTAMP(3),
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'PENDING',
    "targetWarehouse" VARCHAR(255),
    "terms" VARCHAR(255),
    "termsContent" TEXT,
    "letterHead" VARCHAR(255),
    "printHeading" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_items" (
    "id" TEXT NOT NULL,
    "materialRequestId" TEXT NOT NULL,
    "itemCode" VARCHAR(100) NOT NULL,
    "itemName" VARCHAR(255),
    "requiredBy" TIMESTAMP(3),
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "targetWarehouse" VARCHAR(255),
    "unitOfMeasure" VARCHAR(50),

    CONSTRAINT "material_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_requests_series_key" ON "material_requests"("series");

-- CreateIndex
CREATE INDEX "material_requests_series_idx" ON "material_requests"("series");

-- CreateIndex
CREATE INDEX "material_requests_status_idx" ON "material_requests"("status");

-- CreateIndex
CREATE INDEX "material_requests_transactionDate_idx" ON "material_requests"("transactionDate");

-- CreateIndex
CREATE INDEX "material_request_items_materialRequestId_idx" ON "material_request_items"("materialRequestId");

-- AddForeignKey
ALTER TABLE "material_request_items" ADD CONSTRAINT "material_request_items_materialRequestId_fkey" FOREIGN KEY ("materialRequestId") REFERENCES "material_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
