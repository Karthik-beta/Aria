-- CreateEnum
CREATE TYPE "PickListStatus" AS ENUM ('DRAFT', 'OPEN', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickListPurpose" AS ENUM ('MATERIAL_TRANSFER_FOR_MANUFACTURE', 'DELIVERY', 'MATERIAL_TRANSFER');

-- CreateTable
CREATE TABLE "pick_lists" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "seriesPattern" VARCHAR(50) NOT NULL DEFAULT 'STO-PICK-.YYYY.-',
    "status" "PickListStatus" NOT NULL DEFAULT 'DRAFT',
    "company" VARCHAR(255) NOT NULL,
    "customer" VARCHAR(255),
    "purpose" "PickListPurpose" NOT NULL DEFAULT 'MATERIAL_TRANSFER_FOR_MANUFACTURE',
    "workOrder" VARCHAR(255),
    "warehouse" VARCHAR(255),
    "considerRejectedWarehouses" BOOLEAN NOT NULL DEFAULT false,
    "pickManually" BOOLEAN NOT NULL DEFAULT false,
    "ignorePricingRule" BOOLEAN NOT NULL DEFAULT false,
    "scanMode" BOOLEAN NOT NULL DEFAULT false,
    "promptQty" BOOLEAN NOT NULL DEFAULT false,
    "scanBarcode" VARCHAR(255),
    "groupSameItems" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pick_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_list_items" (
    "id" TEXT NOT NULL,
    "pickListId" TEXT NOT NULL,
    "item" VARCHAR(255) NOT NULL,
    "warehouse" VARCHAR(255),
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockQty" DOUBLE PRECISION,
    "pickedQty" DOUBLE PRECISION,

    CONSTRAINT "pick_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pick_lists_series_key" ON "pick_lists"("series");

-- CreateIndex
CREATE INDEX "pick_lists_series_idx" ON "pick_lists"("series");

-- CreateIndex
CREATE INDEX "pick_lists_status_idx" ON "pick_lists"("status");

-- CreateIndex
CREATE INDEX "pick_list_items_pickListId_idx" ON "pick_list_items"("pickListId");

-- AddForeignKey
ALTER TABLE "pick_list_items" ADD CONSTRAINT "pick_list_items_pickListId_fkey" FOREIGN KEY ("pickListId") REFERENCES "pick_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
