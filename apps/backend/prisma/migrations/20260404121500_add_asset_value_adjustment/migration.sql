-- CreateEnum
CREATE TYPE "AssetValueAdjustmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AssetValueAdjustmentDirection" AS ENUM ('INCREASE', 'DECREASE');

-- CreateEnum
CREATE TYPE "AssetRevaluationEntryStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AssetRevaluationLineType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "AssetDepreciationScheduleStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "asset_value_adjustments" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetCategorySnapshot" VARCHAR(255),
    "companySnapshot" VARCHAR(255) NOT NULL,
    "adjustmentDate" TIMESTAMP(3) NOT NULL,
    "currentAssetValue" DECIMAL(18,6) NOT NULL,
    "newAssetValue" DECIMAL(18,6) NOT NULL,
    "differenceAmount" DECIMAL(18,6) NOT NULL,
    "differenceAccount" VARCHAR(255) NOT NULL,
    "fixedAssetAccount" VARCHAR(255) NOT NULL,
    "costCenter" VARCHAR(255),
    "notes" TEXT,
    "status" "AssetValueAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "direction" "AssetValueAdjustmentDirection" NOT NULL,
    "previousAssetStatus" "AssetStatus" NOT NULL,
    "previousIsFullyDepreciated" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_value_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_revaluation_entries" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "company" VARCHAR(255) NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "remarks" VARCHAR(500) NOT NULL,
    "status" "AssetRevaluationEntryStatus" NOT NULL DEFAULT 'POSTED',
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_revaluation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_revaluation_entry_lines" (
    "id" TEXT NOT NULL,
    "revaluationEntryId" TEXT NOT NULL,
    "lineType" "AssetRevaluationLineType" NOT NULL,
    "account" VARCHAR(255) NOT NULL,
    "debitAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "costCenter" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_revaluation_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_depreciation_schedules" (
    "id" TEXT NOT NULL,
    "adjustmentId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "previousScheduleId" TEXT,
    "revisionNumber" INTEGER NOT NULL,
    "status" "AssetDepreciationScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "depreciationMethod" "DepreciationMethod",
    "totalNumberOfDepreciations" INTEGER NOT NULL,
    "frequencyOfDepreciation" INTEGER NOT NULL,
    "bookedDepreciations" INTEGER NOT NULL,
    "remainingDepreciations" INTEGER NOT NULL,
    "openingAccumulatedDepreciation" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "baseAssetValue" DECIMAL(18,6) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_depreciation_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_depreciation_schedule_entries" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "scheduleDate" TIMESTAMP(3) NOT NULL,
    "depreciationAmount" DECIMAL(18,6) NOT NULL,
    "accumulatedDepreciationAmount" DECIMAL(18,6) NOT NULL,
    "bookValueAfterDepreciation" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_depreciation_schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_value_adjustments_series_key" ON "asset_value_adjustments"("series");

-- CreateIndex
CREATE INDEX "asset_value_adjustments_assetId_idx" ON "asset_value_adjustments"("assetId");

-- CreateIndex
CREATE INDEX "asset_value_adjustments_status_idx" ON "asset_value_adjustments"("status");

-- CreateIndex
CREATE INDEX "asset_value_adjustments_adjustmentDate_idx" ON "asset_value_adjustments"("adjustmentDate");

-- CreateIndex
CREATE INDEX "asset_value_adjustments_companySnapshot_idx" ON "asset_value_adjustments"("companySnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "asset_revaluation_entries_series_key" ON "asset_revaluation_entries"("series");

-- CreateIndex
CREATE UNIQUE INDEX "asset_revaluation_entries_adjustmentId_key" ON "asset_revaluation_entries"("adjustmentId");

-- CreateIndex
CREATE INDEX "asset_revaluation_entries_assetId_idx" ON "asset_revaluation_entries"("assetId");

-- CreateIndex
CREATE INDEX "asset_revaluation_entries_status_idx" ON "asset_revaluation_entries"("status");

-- CreateIndex
CREATE INDEX "asset_revaluation_entries_postingDate_idx" ON "asset_revaluation_entries"("postingDate");

-- CreateIndex
CREATE INDEX "asset_revaluation_entry_lines_revaluationEntryId_idx" ON "asset_revaluation_entry_lines"("revaluationEntryId");

-- CreateIndex
CREATE INDEX "asset_revaluation_entry_lines_account_idx" ON "asset_revaluation_entry_lines"("account");

-- CreateIndex
CREATE UNIQUE INDEX "asset_depreciation_schedules_adjustmentId_key" ON "asset_depreciation_schedules"("adjustmentId");

-- CreateIndex
CREATE INDEX "asset_depreciation_schedules_assetId_idx" ON "asset_depreciation_schedules"("assetId");

-- CreateIndex
CREATE INDEX "asset_depreciation_schedules_status_idx" ON "asset_depreciation_schedules"("status");

-- CreateIndex
CREATE INDEX "asset_depreciation_schedules_startDate_idx" ON "asset_depreciation_schedules"("startDate");

-- CreateIndex
CREATE INDEX "asset_depreciation_schedules_previousScheduleId_idx" ON "asset_depreciation_schedules"("previousScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "asset_depreciation_schedule_entries_scheduleId_sequence_key" ON "asset_depreciation_schedule_entries"("scheduleId", "sequence");

-- CreateIndex
CREATE INDEX "asset_depreciation_schedule_entries_scheduleId_idx" ON "asset_depreciation_schedule_entries"("scheduleId");

-- CreateIndex
CREATE INDEX "asset_depreciation_schedule_entries_scheduleDate_idx" ON "asset_depreciation_schedule_entries"("scheduleDate");

-- AddForeignKey
ALTER TABLE "asset_value_adjustments" ADD CONSTRAINT "asset_value_adjustments_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_revaluation_entries" ADD CONSTRAINT "asset_revaluation_entries_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "asset_value_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_revaluation_entries" ADD CONSTRAINT "asset_revaluation_entries_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_revaluation_entry_lines" ADD CONSTRAINT "asset_revaluation_entry_lines_revaluationEntryId_fkey" FOREIGN KEY ("revaluationEntryId") REFERENCES "asset_revaluation_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciation_schedules" ADD CONSTRAINT "asset_depreciation_schedules_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "asset_value_adjustments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciation_schedules" ADD CONSTRAINT "asset_depreciation_schedules_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciation_schedules" ADD CONSTRAINT "asset_depreciation_schedules_previousScheduleId_fkey" FOREIGN KEY ("previousScheduleId") REFERENCES "asset_depreciation_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciation_schedule_entries" ADD CONSTRAINT "asset_depreciation_schedule_entries_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "asset_depreciation_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;