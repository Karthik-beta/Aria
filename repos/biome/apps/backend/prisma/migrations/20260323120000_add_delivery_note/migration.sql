-- CreateEnum
CREATE TYPE "DeliveryNoteStatus" AS ENUM ('DRAFT', 'TO_BILL', 'COMPLETED', 'RETURN_ISSUED', 'CANCELLED', 'CLOSED');

-- CreateTable
CREATE TABLE "delivery_notes" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer" VARCHAR(255) NOT NULL,
    "company" VARCHAR(255) NOT NULL,
    "status" "DeliveryNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "isReturn" BOOLEAN NOT NULL DEFAULT false,
    "currency" VARCHAR(10),
    "priceList" VARCHAR(255),
    "sourceWarehouse" VARCHAR(255),
    "totalQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roundingAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roundedTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "additionalDiscountOn" VARCHAR(100),
    "additionalDiscountPercent" DOUBLE PRECISION,
    "additionalDiscountAmount" DOUBLE PRECISION,
    "shippingAddress" VARCHAR(255),
    "dispatchAddress" VARCHAR(255),
    "companyAddress" VARCHAR(255),
    "companyContact" VARCHAR(255),
    "companyTRN" VARCHAR(100),
    "terms" VARCHAR(255),
    "termsContent" TEXT,
    "transporter" VARCHAR(255),
    "driverName" VARCHAR(255),
    "driver" VARCHAR(255),
    "transportReceiptDate" TIMESTAMP(3),
    "transportReceiptNo" VARCHAR(255),
    "vehicleNo" VARCHAR(100),
    "customerPoNo" TEXT,
    "customerPoDate" TIMESTAMP(3),
    "salesPartner" VARCHAR(255),
    "commissionRate" DOUBLE PRECISION,
    "letterHead" VARCHAR(255),
    "printHeading" VARCHAR(255),
    "printWithoutAmount" BOOLEAN NOT NULL DEFAULT false,
    "groupSameItems" BOOLEAN NOT NULL DEFAULT false,
    "permitNumber" VARCHAR(255),
    "vatEmirate" VARCHAR(100),
    "project" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_note_items" (
    "id" TEXT NOT NULL,
    "deliveryNoteId" TEXT NOT NULL,
    "itemCode" VARCHAR(100) NOT NULL,
    "itemName" VARCHAR(255),
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uom" VARCHAR(50),
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warehouse" VARCHAR(255),

    CONSTRAINT "delivery_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_notes_series_key" ON "delivery_notes"("series");

-- CreateIndex
CREATE INDEX "delivery_notes_series_idx" ON "delivery_notes"("series");

-- CreateIndex
CREATE INDEX "delivery_notes_status_idx" ON "delivery_notes"("status");

-- CreateIndex
CREATE INDEX "delivery_notes_postingDate_idx" ON "delivery_notes"("postingDate");

-- CreateIndex
CREATE INDEX "delivery_notes_customer_idx" ON "delivery_notes"("customer");

-- CreateIndex
CREATE INDEX "delivery_note_items_deliveryNoteId_idx" ON "delivery_note_items"("deliveryNoteId");

-- AddForeignKey
ALTER TABLE "delivery_note_items" ADD CONSTRAINT "delivery_note_items_deliveryNoteId_fkey" FOREIGN KEY ("deliveryNoteId") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
