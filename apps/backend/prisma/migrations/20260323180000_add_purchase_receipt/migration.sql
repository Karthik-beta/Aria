-- CreateEnum
CREATE TYPE "PurchaseReceiptStatus" AS ENUM ('DRAFT', 'PARTLY_BILLED', 'TO_BILL', 'COMPLETED', 'RETURN_ISSUED', 'CANCELLED', 'CLOSED');

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "seriesPattern" VARCHAR(50) NOT NULL DEFAULT 'MAT-PRE-.YYYY.-',
    "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postingTime" VARCHAR(8) NOT NULL DEFAULT '00:00:00',
    "editPostingDateTime" BOOLEAN NOT NULL DEFAULT false,
    "supplier" VARCHAR(255) NOT NULL,
    "company" VARCHAR(255) NOT NULL,
    "status" "PurchaseReceiptStatus" NOT NULL DEFAULT 'DRAFT',
    "isReturn" BOOLEAN NOT NULL DEFAULT false,
    "applyPutawayRule" BOOLEAN NOT NULL DEFAULT false,
    "supplierDeliveryNote" VARCHAR(255),
    "acceptedWarehouse" VARCHAR(255),
    "rejectedWarehouse" VARCHAR(255),
    "isSubcontracted" BOOLEAN NOT NULL DEFAULT false,
    "currency" VARCHAR(10),
    "priceList" VARCHAR(255),
    "totalQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAcceptedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRejectedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxesAndChargesAdded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxesAndChargesDeducted" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTaxesAndCharges" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roundingAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roundedTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disableRoundedTotal" BOOLEAN NOT NULL DEFAULT false,
    "supplierAddress" VARCHAR(255),
    "contactPerson" VARCHAR(255),
    "shippingAddressTemplate" VARCHAR(255),
    "companyTRN" VARCHAR(100),
    "billingAddress" VARCHAR(255),
    "terms" VARCHAR(255),
    "termsContent" TEXT,
    "letterHead" VARCHAR(255),
    "printHeading" VARCHAR(255),
    "groupSameItems" BOOLEAN NOT NULL DEFAULT false,
    "permitNumber" VARCHAR(255),
    "recoverableStandardRatedExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reverseChargeApplicable" VARCHAR(10) NOT NULL DEFAULT 'N',
    "transporterName" VARCHAR(255),
    "vehicleNumber" VARCHAR(100),
    "vehicleDate" TIMESTAMP(3),
    "instructions" TEXT,
    "remarks" TEXT,
    "isInternalSupplier" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_items" (
    "id" TEXT NOT NULL,
    "purchaseReceiptId" TEXT NOT NULL,
    "itemCode" VARCHAR(100) NOT NULL,
    "itemName" VARCHAR(255),
    "description" TEXT,
    "acceptedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rejectedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uom" VARCHAR(50),
    "acceptedWarehouse" VARCHAR(255),
    "rejectedWarehouse" VARCHAR(255),

    CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_taxes" (
    "id" TEXT NOT NULL,
    "purchaseReceiptId" TEXT NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    "accountHead" VARCHAR(255) NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_receipt_taxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipts_series_key" ON "purchase_receipts"("series");

-- CreateIndex
CREATE INDEX "purchase_receipts_series_idx" ON "purchase_receipts"("series");

-- CreateIndex
CREATE INDEX "purchase_receipts_status_idx" ON "purchase_receipts"("status");

-- CreateIndex
CREATE INDEX "purchase_receipts_postingDate_idx" ON "purchase_receipts"("postingDate");

-- CreateIndex
CREATE INDEX "purchase_receipts_supplier_idx" ON "purchase_receipts"("supplier");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_purchaseReceiptId_idx" ON "purchase_receipt_items"("purchaseReceiptId");

-- CreateIndex
CREATE INDEX "purchase_receipt_taxes_purchaseReceiptId_idx" ON "purchase_receipt_taxes"("purchaseReceiptId");

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_taxes" ADD CONSTRAINT "purchase_receipt_taxes_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
