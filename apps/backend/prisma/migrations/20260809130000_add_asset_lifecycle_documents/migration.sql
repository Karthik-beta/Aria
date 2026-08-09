-- Asset lifecycle documents added to the Prisma schema after the prior migration head.
-- This migration is additive: existing asset, depreciation, and inventory rows are preserved.

CREATE TYPE "AssetMovementPurpose" AS ENUM ('TRANSFER', 'ISSUE', 'RECEIPT', 'TRANSFER_AND_ISSUE');
CREATE TYPE "AssetMovementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');
CREATE TYPE "AssetRepairStatus" AS ENUM ('DRAFT', 'PENDING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AssetCapitalizationTargetType" AS ENUM ('NEW_ASSET', 'EXISTING_ASSET');
CREATE TYPE "AssetCapitalizationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');
CREATE TYPE "AssetDisposalType" AS ENUM ('SCRAP', 'SELL');
CREATE TYPE "AssetDisposalStatus" AS ENUM ('POSTED', 'CANCELLED');
CREATE TYPE "AssetAccountingSourceType" AS ENUM ('DISPOSAL', 'REPAIR', 'CAPITALIZATION', 'CWIP_CAPITALIZATION');
CREATE TYPE "AssetAccountingEntryStatus" AS ENUM ('POSTED', 'REVERSED');
CREATE TYPE "AssetAccountingLineType" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "AssetType" AS ENUM ('EXISTING_ASSET', 'COMPOSITE_ASSET', 'COMPOSITE_COMPONENT');

ALTER TYPE "AssetStatus" ADD VALUE IF NOT EXISTS 'CAPITALIZED';

ALTER TABLE "assets"
  ADD COLUMN "assetType" "AssetType" NOT NULL DEFAULT 'EXISTING_ASSET';
CREATE INDEX "assets_assetType_idx" ON "assets"("assetType");

ALTER TABLE "asset_activities" ADD COLUMN "userId" VARCHAR(255);
ALTER TABLE "asset_activities"
  ADD CONSTRAINT "asset_activities_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "asset_activities_userId_idx" ON "asset_activities"("userId");

-- Value adjustments must retain the finance-book identity they revise. Existing
-- rows are backfilled from their latest linked schedule first, then only when
-- the asset has exactly one configured book. Ambiguous multi-book and
-- non-depreciating legacy rows legitimately remain unbooked.
ALTER TABLE "asset_value_adjustments"
  ADD COLUMN "financeBookId" TEXT,
  ADD COLUMN "previousAssetValueAfterDepreciation" DECIMAL(18,6);

-- ERPNext tracks repair-driven useful-life extensions as cumulative months on
-- each finance book. The base number of depreciations remains unchanged.
ALTER TABLE "asset_finance_books"
  ADD COLUMN "increaseInAssetLife" INTEGER NOT NULL DEFAULT 0;

UPDATE "asset_value_adjustments" AS adjustment
SET "financeBookId" = (
  SELECT book."financeBookId"
  FROM "asset_depreciation_schedules" AS schedule
  JOIN "asset_finance_books" AS book
    ON book."id" = schedule."assetFinanceBookId"
  WHERE schedule."adjustmentId" = adjustment."id"
  ORDER BY schedule."revisionNumber" DESC, schedule."createdAt" DESC, schedule."id" DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM "asset_depreciation_schedules" AS schedule
  WHERE schedule."adjustmentId" = adjustment."id"
);

UPDATE "asset_value_adjustments" AS adjustment
SET "financeBookId" = (
  SELECT book."financeBookId"
  FROM "asset_finance_books" AS book
  WHERE book."assetId" = adjustment."assetId"
  ORDER BY book."createdAt" ASC, book."id" ASC
  LIMIT 1
)
WHERE adjustment."financeBookId" IS NULL
  AND 1 = (
    SELECT COUNT(*)
    FROM "asset_finance_books" AS book
    WHERE book."assetId" = adjustment."assetId"
  );

UPDATE "asset_value_adjustments"
SET "previousAssetValueAfterDepreciation" = "currentAssetValue"
WHERE "previousAssetValueAfterDepreciation" IS NULL;

CREATE INDEX "asset_value_adjustments_financeBookId_idx"
  ON "asset_value_adjustments"("financeBookId");
ALTER TABLE "asset_value_adjustments"
  ADD CONSTRAINT "asset_value_adjustments_financeBookId_fkey"
  FOREIGN KEY ("financeBookId") REFERENCES "finance_books"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "asset_movements" (
  "id" TEXT NOT NULL,
  "series" VARCHAR(50) NOT NULL,
  "company" VARCHAR(255) NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "purpose" "AssetMovementPurpose" NOT NULL DEFAULT 'TRANSFER',
  "status" "AssetMovementStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_movement_items" (
  "id" TEXT NOT NULL,
  "movementId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "sourceLocationId" TEXT,
  "targetLocationId" TEXT,
  "fromEmployee" VARCHAR(255),
  "toEmployee" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_movement_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_repairs" (
  "id" TEXT NOT NULL,
  "series" VARCHAR(50) NOT NULL,
  "assetId" TEXT NOT NULL,
  "company" VARCHAR(255) NOT NULL,
  "failureDate" TIMESTAMP(3) NOT NULL,
  "completionDate" TIMESTAMP(3),
  "repairStatus" "AssetRepairStatus" NOT NULL DEFAULT 'DRAFT',
  "repairCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "capitalizeRepairCost" BOOLEAN NOT NULL DEFAULT false,
  "increaseInAssetLife" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "submittedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "stockEntryId" TEXT,
  "accountingEntryId" TEXT,
  "previousAssetStatus" "AssetStatus",
  "previousNetPurchaseAmount" DECIMAL(18,6),
  "previousValueAfterDepreciation" DECIMAL(18,6),
  "previousTotalDepreciations" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_repairs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_repair_consumed_items" (
  "id" TEXT NOT NULL,
  "repairId" TEXT NOT NULL,
  "assetId" TEXT,
  "itemCode" VARCHAR(100) NOT NULL,
  "warehouse" VARCHAR(255),
  "expenseAccount" VARCHAR(255),
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "valuationRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_repair_consumed_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_repair_purchase_invoices" (
  "id" TEXT NOT NULL,
  "repairId" TEXT NOT NULL,
  "purchaseInvoice" VARCHAR(100) NOT NULL,
  "expenseAccount" VARCHAR(255),
  "amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_repair_purchase_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_capitalizations" (
  "id" TEXT NOT NULL,
  "series" VARCHAR(50) NOT NULL,
  "company" VARCHAR(255) NOT NULL,
  "postingDate" TIMESTAMP(3) NOT NULL,
  "targetType" "AssetCapitalizationTargetType" NOT NULL DEFAULT 'NEW_ASSET',
  "targetAssetId" TEXT,
  "targetAssetName" VARCHAR(255),
  "targetAssetCategory" VARCHAR(255),
  "targetItemCode" VARCHAR(100),
  "status" "AssetCapitalizationStatus" NOT NULL DEFAULT 'DRAFT',
  "totalStockValue" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "totalAssetValue" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "totalServiceValue" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "totalValue" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "submittedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "stockEntryId" TEXT,
  "accountingEntryId" TEXT,
  "createdTargetAsset" BOOLEAN NOT NULL DEFAULT false,
  "targetPreviousNetPurchaseAmount" DECIMAL(18,6),
  "targetPreviousValueAfterDepreciation" DECIMAL(18,6),
  "targetPreviousStatus" "AssetStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_capitalizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_capitalization_stock_items" (
  "id" TEXT NOT NULL,
  "capitalizationId" TEXT NOT NULL,
  "itemCode" VARCHAR(100) NOT NULL,
  "warehouse" VARCHAR(255),
  "expenseAccount" VARCHAR(255),
  "stockQty" INTEGER NOT NULL DEFAULT 1,
  "valuationRate" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_capitalization_stock_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_capitalization_asset_items" (
  "id" TEXT NOT NULL,
  "capitalizationId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "assetValue" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "previousStatus" "AssetStatus",
  "previousDisposalDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_capitalization_asset_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_capitalization_service_items" (
  "id" TEXT NOT NULL,
  "capitalizationId" TEXT NOT NULL,
  "itemCode" VARCHAR(100),
  "expenseAccount" VARCHAR(255) NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_capitalization_service_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_disposals" (
  "id" TEXT NOT NULL,
  "series" VARCHAR(50) NOT NULL,
  "assetId" TEXT NOT NULL,
  "company" VARCHAR(255) NOT NULL,
  "disposalDate" TIMESTAMP(3) NOT NULL,
  "disposalType" "AssetDisposalType" NOT NULL,
  "salesAmount" DECIMAL(18,6),
  "gainLossAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "fixedAssetAccount" VARCHAR(255),
  "accumulatedDepreciationAccount" VARCHAR(255),
  "proceedsAccount" VARCHAR(255),
  "gainLossAccount" VARCHAR(255),
  "costCenter" VARCHAR(255),
  "accountingEntryId" TEXT,
  "previousAssetStatus" "AssetStatus",
  "previousIsFullyDepreciated" BOOLEAN,
  "status" "AssetDisposalStatus" NOT NULL DEFAULT 'POSTED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_disposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_accounting_entries" (
  "id" TEXT NOT NULL,
  "series" VARCHAR(50) NOT NULL,
  "company" VARCHAR(255) NOT NULL,
  "assetId" TEXT,
  "sourceType" "AssetAccountingSourceType" NOT NULL,
  "sourceId" VARCHAR(255) NOT NULL,
  "postingDate" TIMESTAMP(3) NOT NULL,
  "remarks" VARCHAR(500) NOT NULL,
  "status" "AssetAccountingEntryStatus" NOT NULL DEFAULT 'POSTED',
  "reversedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_accounting_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_accounting_entry_lines" (
  "id" TEXT NOT NULL,
  "accountingEntryId" TEXT NOT NULL,
  "lineType" "AssetAccountingLineType" NOT NULL,
  "account" VARCHAR(255) NOT NULL,
  "debitAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "creditAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "costCenter" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_accounting_entry_lines_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "assets" ADD COLUMN "cwipAccountingEntryId" TEXT;
ALTER TABLE "assets" ADD COLUMN "cwipBookedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "asset_movements_series_key" ON "asset_movements"("series");
CREATE INDEX "asset_movements_series_idx" ON "asset_movements"("series");
CREATE INDEX "asset_movements_status_idx" ON "asset_movements"("status");
CREATE INDEX "asset_movements_transactionDate_idx" ON "asset_movements"("transactionDate");
CREATE INDEX "asset_movements_company_idx" ON "asset_movements"("company");
CREATE INDEX "asset_movements_company_status_transactionDate_idx" ON "asset_movements"("company", "status", "transactionDate");
CREATE INDEX "asset_movement_items_movementId_idx" ON "asset_movement_items"("movementId");
CREATE INDEX "asset_movement_items_assetId_idx" ON "asset_movement_items"("assetId");
CREATE UNIQUE INDEX "asset_movement_items_movementId_assetId_key" ON "asset_movement_items"("movementId", "assetId");
CREATE INDEX "asset_movement_items_assetId_movementId_idx" ON "asset_movement_items"("assetId", "movementId");
CREATE INDEX "asset_movement_items_sourceLocationId_idx" ON "asset_movement_items"("sourceLocationId");
CREATE INDEX "asset_movement_items_targetLocationId_idx" ON "asset_movement_items"("targetLocationId");

CREATE UNIQUE INDEX "asset_repairs_series_key" ON "asset_repairs"("series");
CREATE UNIQUE INDEX "asset_repairs_stockEntryId_key" ON "asset_repairs"("stockEntryId");
CREATE UNIQUE INDEX "asset_repairs_accountingEntryId_key" ON "asset_repairs"("accountingEntryId");
CREATE INDEX "asset_repairs_assetId_idx" ON "asset_repairs"("assetId");
CREATE INDEX "asset_repairs_repairStatus_idx" ON "asset_repairs"("repairStatus");
CREATE INDEX "asset_repairs_failureDate_idx" ON "asset_repairs"("failureDate");
CREATE INDEX "asset_repairs_company_idx" ON "asset_repairs"("company");
CREATE INDEX "asset_repair_consumed_items_repairId_idx" ON "asset_repair_consumed_items"("repairId");
CREATE INDEX "asset_repair_consumed_items_itemCode_idx" ON "asset_repair_consumed_items"("itemCode");
CREATE INDEX "asset_repair_consumed_items_assetId_idx" ON "asset_repair_consumed_items"("assetId");
CREATE INDEX "asset_repair_purchase_invoices_repairId_idx" ON "asset_repair_purchase_invoices"("repairId");
CREATE UNIQUE INDEX "asset_repair_purchase_invoices_repairId_purchaseInvoice_expenseAccount_key" ON "asset_repair_purchase_invoices"("repairId", "purchaseInvoice", "expenseAccount");

CREATE UNIQUE INDEX "asset_capitalizations_series_key" ON "asset_capitalizations"("series");
CREATE UNIQUE INDEX "asset_capitalizations_stockEntryId_key" ON "asset_capitalizations"("stockEntryId");
CREATE UNIQUE INDEX "asset_capitalizations_accountingEntryId_key" ON "asset_capitalizations"("accountingEntryId");
CREATE INDEX "asset_capitalizations_series_idx" ON "asset_capitalizations"("series");
CREATE INDEX "asset_capitalizations_status_idx" ON "asset_capitalizations"("status");
CREATE INDEX "asset_capitalizations_postingDate_idx" ON "asset_capitalizations"("postingDate");
CREATE INDEX "asset_capitalizations_company_idx" ON "asset_capitalizations"("company");
CREATE INDEX "asset_capitalization_stock_items_capitalizationId_idx" ON "asset_capitalization_stock_items"("capitalizationId");
CREATE INDEX "asset_capitalization_stock_items_itemCode_idx" ON "asset_capitalization_stock_items"("itemCode");
CREATE INDEX "asset_capitalization_asset_items_capitalizationId_idx" ON "asset_capitalization_asset_items"("capitalizationId");
CREATE INDEX "asset_capitalization_asset_items_assetId_idx" ON "asset_capitalization_asset_items"("assetId");
CREATE UNIQUE INDEX "asset_capitalization_asset_items_capitalizationId_assetId_key" ON "asset_capitalization_asset_items"("capitalizationId", "assetId");
CREATE INDEX "asset_capitalization_service_items_capitalizationId_idx" ON "asset_capitalization_service_items"("capitalizationId");

CREATE UNIQUE INDEX "asset_disposals_series_key" ON "asset_disposals"("series");
CREATE UNIQUE INDEX "asset_disposals_accountingEntryId_key" ON "asset_disposals"("accountingEntryId");
CREATE INDEX "asset_disposals_assetId_idx" ON "asset_disposals"("assetId");
CREATE INDEX "asset_disposals_status_idx" ON "asset_disposals"("status");
CREATE INDEX "asset_disposals_disposalDate_idx" ON "asset_disposals"("disposalDate");
CREATE INDEX "asset_disposals_company_idx" ON "asset_disposals"("company");
CREATE UNIQUE INDEX "asset_disposals_one_posted_per_asset" ON "asset_disposals"("assetId") WHERE "status" = 'POSTED';

CREATE UNIQUE INDEX "assets_cwipAccountingEntryId_key" ON "assets"("cwipAccountingEntryId");
CREATE UNIQUE INDEX "asset_accounting_entries_series_key" ON "asset_accounting_entries"("series");
CREATE UNIQUE INDEX "asset_accounting_entries_sourceType_sourceId_key" ON "asset_accounting_entries"("sourceType", "sourceId");
CREATE INDEX "asset_accounting_entries_assetId_postingDate_idx" ON "asset_accounting_entries"("assetId", "postingDate");
CREATE INDEX "asset_accounting_entries_company_postingDate_status_idx" ON "asset_accounting_entries"("company", "postingDate", "status");
CREATE INDEX "asset_accounting_entry_lines_accountingEntryId_idx" ON "asset_accounting_entry_lines"("accountingEntryId");
CREATE INDEX "asset_accounting_entry_lines_account_idx" ON "asset_accounting_entry_lines"("account");

ALTER TABLE "asset_movement_items" ADD CONSTRAINT "asset_movement_items_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "asset_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_movement_items" ADD CONSTRAINT "asset_movement_items_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_movement_items" ADD CONSTRAINT "asset_movement_items_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_movement_items" ADD CONSTRAINT "asset_movement_items_targetLocationId_fkey" FOREIGN KEY ("targetLocationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_repairs" ADD CONSTRAINT "asset_repairs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_repairs" ADD CONSTRAINT "asset_repairs_stockEntryId_fkey" FOREIGN KEY ("stockEntryId") REFERENCES "stock_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_repairs" ADD CONSTRAINT "asset_repairs_accountingEntryId_fkey" FOREIGN KEY ("accountingEntryId") REFERENCES "asset_accounting_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_repair_consumed_items" ADD CONSTRAINT "asset_repair_consumed_items_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "asset_repairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_repair_consumed_items" ADD CONSTRAINT "asset_repair_consumed_items_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_repair_purchase_invoices" ADD CONSTRAINT "asset_repair_purchase_invoices_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "asset_repairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_capitalizations" ADD CONSTRAINT "asset_capitalizations_targetAssetId_fkey" FOREIGN KEY ("targetAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_capitalizations" ADD CONSTRAINT "asset_capitalizations_stockEntryId_fkey" FOREIGN KEY ("stockEntryId") REFERENCES "stock_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_capitalizations" ADD CONSTRAINT "asset_capitalizations_accountingEntryId_fkey" FOREIGN KEY ("accountingEntryId") REFERENCES "asset_accounting_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_capitalization_stock_items" ADD CONSTRAINT "asset_capitalization_stock_items_capitalizationId_fkey" FOREIGN KEY ("capitalizationId") REFERENCES "asset_capitalizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_capitalization_asset_items" ADD CONSTRAINT "asset_capitalization_asset_items_capitalizationId_fkey" FOREIGN KEY ("capitalizationId") REFERENCES "asset_capitalizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_capitalization_asset_items" ADD CONSTRAINT "asset_capitalization_asset_items_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_capitalization_service_items" ADD CONSTRAINT "asset_capitalization_service_items_capitalizationId_fkey" FOREIGN KEY ("capitalizationId") REFERENCES "asset_capitalizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_accountingEntryId_fkey" FOREIGN KEY ("accountingEntryId") REFERENCES "asset_accounting_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_accounting_entries" ADD CONSTRAINT "asset_accounting_entries_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_accounting_entry_lines" ADD CONSTRAINT "asset_accounting_entry_lines_accountingEntryId_fkey" FOREIGN KEY ("accountingEntryId") REFERENCES "asset_accounting_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_cwipAccountingEntryId_fkey" FOREIGN KEY ("cwipAccountingEntryId") REFERENCES "asset_accounting_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
