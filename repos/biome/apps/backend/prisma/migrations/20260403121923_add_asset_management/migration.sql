-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED', 'PARTIALLY_DEPRECIATED', 'FULLY_DEPRECIATED', 'SOLD', 'SCRAPPED', 'IN_MAINTENANCE', 'OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "AssetOwner" AS ENUM ('COMPANY', 'SUPPLIER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DOUBLE_DECLINING_BALANCE', 'WRITTEN_DOWN_VALUE', 'MANUAL');

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "parentLocationId" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "depreciationMethod" "DepreciationMethod",
    "totalNumberOfDepreciations" INTEGER,
    "frequencyOfDepreciation" INTEGER,
    "nonDepreciableCategory" BOOLEAN NOT NULL DEFAULT false,
    "enableCwipAccounting" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "assetName" VARCHAR(255) NOT NULL,
    "itemCode" VARCHAR(100) NOT NULL,
    "assetCategoryId" TEXT,
    "company" VARCHAR(255) NOT NULL,
    "locationId" TEXT,
    "custodian" VARCHAR(255),
    "department" VARCHAR(255),
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "availableForUseDate" TIMESTAMP(3),
    "disposalDate" TIMESTAMP(3),
    "netPurchaseAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "assetQuantity" INTEGER NOT NULL DEFAULT 1,
    "calculateDepreciation" BOOLEAN NOT NULL DEFAULT false,
    "openingAccumulatedDepreciation" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "openingNumberOfBookedDepreciations" INTEGER NOT NULL DEFAULT 0,
    "isFullyDepreciated" BOOLEAN NOT NULL DEFAULT false,
    "valueAfterDepreciation" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "maintenanceRequired" BOOLEAN NOT NULL DEFAULT false,
    "assetOwner" "AssetOwner" NOT NULL DEFAULT 'COMPANY',
    "assetOwnerCompany" VARCHAR(255),
    "supplier" VARCHAR(255),
    "customer" VARCHAR(255),
    "policyNumber" VARCHAR(100),
    "insurer" VARCHAR(255),
    "insuredValue" DECIMAL(18,6),
    "insuranceStartDate" TIMESTAMP(3),
    "insuranceEndDate" TIMESTAMP(3),
    "depreciationMethod" "DepreciationMethod",
    "totalNumberOfDepreciations" INTEGER,
    "frequencyOfDepreciation" INTEGER,
    "purchaseReceipt" VARCHAR(100),
    "purchaseInvoice" VARCHAR(100),
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_activities" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "activity" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");

-- CreateIndex
CREATE INDEX "locations_name_idx" ON "locations"("name");

-- CreateIndex
CREATE INDEX "locations_parentLocationId_idx" ON "locations"("parentLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_name_key" ON "asset_categories"("name");

-- CreateIndex
CREATE INDEX "asset_categories_name_idx" ON "asset_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "assets_series_key" ON "assets"("series");

-- CreateIndex
CREATE INDEX "assets_series_idx" ON "assets"("series");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_itemCode_idx" ON "assets"("itemCode");

-- CreateIndex
CREATE INDEX "assets_company_idx" ON "assets"("company");

-- CreateIndex
CREATE INDEX "assets_locationId_idx" ON "assets"("locationId");

-- CreateIndex
CREATE INDEX "assets_assetCategoryId_idx" ON "assets"("assetCategoryId");

-- CreateIndex
CREATE INDEX "assets_purchaseDate_idx" ON "assets"("purchaseDate");

-- CreateIndex
CREATE INDEX "asset_activities_assetId_idx" ON "asset_activities"("assetId");

-- CreateIndex
CREATE INDEX "asset_activities_createdAt_idx" ON "asset_activities"("createdAt");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentLocationId_fkey" FOREIGN KEY ("parentLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_activities" ADD CONSTRAINT "asset_activities_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
