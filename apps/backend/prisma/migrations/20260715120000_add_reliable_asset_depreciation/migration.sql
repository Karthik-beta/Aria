-- Extend the existing schedule lifecycle before creating the new persistence graph.
ALTER TYPE "AssetDepreciationScheduleStatus" ADD VALUE IF NOT EXISTS 'DRAFT' BEFORE 'ACTIVE';

CREATE TYPE "AssetFinanceBookPostingStatus" AS ENUM (
    'PENDING',
    'PARTIALLY_DEPRECIATED',
    'FULLY_DEPRECIATED'
);

CREATE TYPE "AssetDepreciationJournalEntryStatus" AS ENUM ('POSTED', 'REVERSED');

-- Finance books are independent valuation ledgers. Existing installations receive one
-- deterministic default book so legacy asset settings can be migrated without ambiguity.
CREATE TABLE "finance_books" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_books_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finance_books_name_key" ON "finance_books"("name");
CREATE INDEX "finance_books_name_idx" ON "finance_books"("name");

INSERT INTO "finance_books" ("id", "name", "createdAt", "updatedAt")
VALUES (
    'c' || substr(md5('aria-default-finance-book'), 1, 24),
    'Default Finance Book',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

ALTER TABLE "Company"
    ADD COLUMN "defaultFinanceBookId" TEXT,
    ADD COLUMN "depreciationEntrySeries" VARCHAR(50) DEFAULT 'DEP-.YYYY.-',
    ADD COLUMN "defaultCostCenter" VARCHAR(255),
    ADD COLUMN "accumulatedDepreciationAccount" VARCHAR(255),
    ADD COLUMN "depreciationExpenseAccount" VARCHAR(255),
    ADD COLUMN "accountsFrozenThrough" TIMESTAMP(3);

UPDATE "Company"
SET "defaultFinanceBookId" = 'c' || substr(md5('aria-default-finance-book'), 1, 24)
WHERE "defaultFinanceBookId" IS NULL;

CREATE INDEX "Company_defaultFinanceBookId_idx" ON "Company"("defaultFinanceBookId");

ALTER TABLE "Company"
    ADD CONSTRAINT "Company_defaultFinanceBookId_fkey"
    FOREIGN KEY ("defaultFinanceBookId") REFERENCES "finance_books"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "asset_category_finance_books" (
    "id" TEXT NOT NULL,
    "assetCategoryId" TEXT NOT NULL,
    "financeBookId" TEXT NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL,
    "totalNumberOfDepreciations" INTEGER NOT NULL,
    "frequencyOfDepreciation" INTEGER NOT NULL,
    "dailyProrataBased" BOOLEAN NOT NULL DEFAULT false,
    "shiftBased" BOOLEAN NOT NULL DEFAULT false,
    "rateOfDepreciation" DECIMAL(9,6),
    "expectedValueAfterUsefulLife" DECIMAL(18,6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_category_finance_books_pkey" PRIMARY KEY ("id")
);

INSERT INTO "asset_category_finance_books" (
    "id",
    "assetCategoryId",
    "financeBookId",
    "depreciationMethod",
    "totalNumberOfDepreciations",
    "frequencyOfDepreciation",
    "dailyProrataBased",
    "shiftBased",
    "rateOfDepreciation",
    "expectedValueAfterUsefulLife",
    "createdAt",
    "updatedAt"
)
SELECT
    'c' || substr(md5('asset-category-finance-book:' || category."id"), 1, 24),
    category."id",
    'c' || substr(md5('aria-default-finance-book'), 1, 24),
    category."depreciationMethod",
    category."totalNumberOfDepreciations",
    category."frequencyOfDepreciation",
    category."dailyProrataBased",
    category."shiftBased",
    category."rateOfDepreciation"::DECIMAL(9,6),
    category."expectedValueAfterUsefulLife",
    category."createdAt",
    CURRENT_TIMESTAMP
FROM "asset_categories" AS category
WHERE category."nonDepreciableCategory" = false
  AND category."depreciationMethod" IS NOT NULL
  AND category."totalNumberOfDepreciations" IS NOT NULL
  AND category."totalNumberOfDepreciations" > 0
  AND category."frequencyOfDepreciation" IS NOT NULL
  AND category."frequencyOfDepreciation" > 0;

CREATE UNIQUE INDEX "asset_category_finance_books_assetCategoryId_financeBookId_key"
    ON "asset_category_finance_books"("assetCategoryId", "financeBookId");
CREATE INDEX "asset_category_finance_books_assetCategoryId_idx"
    ON "asset_category_finance_books"("assetCategoryId");
CREATE INDEX "asset_category_finance_books_financeBookId_idx"
    ON "asset_category_finance_books"("financeBookId");

ALTER TABLE "asset_category_finance_books"
    ADD CONSTRAINT "asset_category_finance_books_assetCategoryId_fkey"
    FOREIGN KEY ("assetCategoryId") REFERENCES "asset_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "asset_category_finance_books_financeBookId_fkey"
    FOREIGN KEY ("financeBookId") REFERENCES "finance_books"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "asset_category_accounts" (
    "id" TEXT NOT NULL,
    "assetCategoryId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fixedAssetAccount" VARCHAR(255) NOT NULL,
    "accumulatedDepreciationAccount" VARCHAR(255),
    "depreciationExpenseAccount" VARCHAR(255),
    "capitalWorkInProgressAccount" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_category_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_category_accounts_assetCategoryId_companyId_key"
    ON "asset_category_accounts"("assetCategoryId", "companyId");
CREATE INDEX "asset_category_accounts_assetCategoryId_idx"
    ON "asset_category_accounts"("assetCategoryId");
CREATE INDEX "asset_category_accounts_companyId_idx"
    ON "asset_category_accounts"("companyId");

ALTER TABLE "asset_category_accounts"
    ADD CONSTRAINT "asset_category_accounts_assetCategoryId_fkey"
    FOREIGN KEY ("assetCategoryId") REFERENCES "asset_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "asset_category_accounts_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "asset_shift_factors" (
    "id" TEXT NOT NULL,
    "shiftName" VARCHAR(100) NOT NULL,
    "shiftFactor" DECIMAL(9,6) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_shift_factors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_shift_factors_shiftName_key" ON "asset_shift_factors"("shiftName");
CREATE INDEX "asset_shift_factors_isDefault_idx" ON "asset_shift_factors"("isDefault");
-- ERPNext allows a single effective default shift factor.
CREATE UNIQUE INDEX "asset_shift_factors_one_default_key"
    ON "asset_shift_factors" ((true)) WHERE "isDefault" = true;

CREATE TABLE "asset_finance_books" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "financeBookId" TEXT NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL,
    "totalNumberOfDepreciations" INTEGER NOT NULL,
    "frequencyOfDepreciation" INTEGER NOT NULL,
    "dailyProrataBased" BOOLEAN NOT NULL DEFAULT false,
    "shiftBased" BOOLEAN NOT NULL DEFAULT false,
    "rateOfDepreciation" DECIMAL(9,6),
    "expectedValueAfterUsefulLife" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "depreciationStartDate" TIMESTAMP(3) NOT NULL,
    "openingAccumulatedDepreciation" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "openingNumberOfBookedDepreciations" INTEGER NOT NULL DEFAULT 0,
    "valueAfterDepreciation" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalNumberOfBookedDepreciations" INTEGER NOT NULL DEFAULT 0,
    "postingStatus" "AssetFinanceBookPostingStatus" NOT NULL DEFAULT 'PENDING',
    "lastPostedDepreciationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_finance_books_pkey" PRIMARY KEY ("id")
);

-- Prefer the legacy asset values, then its most recent schedule, then its category.
-- The fallback values are used only for old schedules whose legacy configuration was incomplete.
INSERT INTO "asset_finance_books" (
    "id",
    "assetId",
    "financeBookId",
    "depreciationMethod",
    "totalNumberOfDepreciations",
    "frequencyOfDepreciation",
    "dailyProrataBased",
    "shiftBased",
    "rateOfDepreciation",
    "expectedValueAfterUsefulLife",
    "depreciationStartDate",
    "openingAccumulatedDepreciation",
    "openingNumberOfBookedDepreciations",
    "valueAfterDepreciation",
    "totalNumberOfBookedDepreciations",
    "postingStatus",
    "createdAt",
    "updatedAt"
)
SELECT
    'c' || substr(md5('asset-finance-book:' || asset."id"), 1, 24),
    asset."id",
    'c' || substr(md5('aria-default-finance-book'), 1, 24),
    COALESCE(asset."depreciationMethod", schedule."depreciationMethod", category."depreciationMethod", 'STRAIGHT_LINE'::"DepreciationMethod"),
    GREATEST(COALESCE(asset."totalNumberOfDepreciations", schedule."totalNumberOfDepreciations", category."totalNumberOfDepreciations", 1), 1),
    GREATEST(COALESCE(asset."frequencyOfDepreciation", schedule."frequencyOfDepreciation", category."frequencyOfDepreciation", 1), 1),
    COALESCE(schedule."dailyProrataBased", category."dailyProrataBased", false),
    COALESCE(schedule."shiftBased", category."shiftBased", false),
    COALESCE(schedule."rateOfDepreciation"::DECIMAL(9,6), category."rateOfDepreciation"::DECIMAL(9,6)),
    COALESCE(asset."expectedValueAfterUsefulLife", schedule."expectedValueAfterUsefulLife", category."expectedValueAfterUsefulLife", 0),
    COALESCE(asset."depreciationStartDate", schedule."startDate", asset."availableForUseDate", asset."purchaseDate"),
    asset."openingAccumulatedDepreciation",
    asset."openingNumberOfBookedDepreciations",
    asset."valueAfterDepreciation",
    asset."openingNumberOfBookedDepreciations",
    CASE
        WHEN asset."isFullyDepreciated" = true OR asset."status" = 'FULLY_DEPRECIATED' THEN 'FULLY_DEPRECIATED'::"AssetFinanceBookPostingStatus"
        WHEN asset."openingNumberOfBookedDepreciations" > 0 OR asset."status" = 'PARTIALLY_DEPRECIATED' THEN 'PARTIALLY_DEPRECIATED'::"AssetFinanceBookPostingStatus"
        ELSE 'PENDING'::"AssetFinanceBookPostingStatus"
    END,
    asset."createdAt",
    CURRENT_TIMESTAMP
FROM "assets" AS asset
LEFT JOIN "asset_categories" AS category ON category."id" = asset."assetCategoryId"
LEFT JOIN LATERAL (
    SELECT candidate.*
    FROM "asset_depreciation_schedules" AS candidate
    WHERE candidate."assetId" = asset."id"
    ORDER BY candidate."revisionNumber" DESC, candidate."createdAt" DESC
    LIMIT 1
) AS schedule ON true
WHERE asset."calculateDepreciation" = true OR schedule."id" IS NOT NULL;

CREATE UNIQUE INDEX "asset_finance_books_assetId_financeBookId_key"
    ON "asset_finance_books"("assetId", "financeBookId");
CREATE INDEX "asset_finance_books_assetId_idx" ON "asset_finance_books"("assetId");
CREATE INDEX "asset_finance_books_financeBookId_idx" ON "asset_finance_books"("financeBookId");
CREATE INDEX "asset_finance_books_postingStatus_idx" ON "asset_finance_books"("postingStatus");
CREATE INDEX "asset_finance_books_lastPostedDepreciationDate_idx"
    ON "asset_finance_books"("lastPostedDepreciationDate");

ALTER TABLE "asset_finance_books"
    ADD CONSTRAINT "asset_finance_books_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "assets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "asset_finance_books_financeBookId_fkey"
    FOREIGN KEY ("financeBookId") REFERENCES "finance_books"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing schedules are value-adjustment revisions. Keep them intact, make their
-- adjustment optional, and attach them to the migrated default asset finance book.
ALTER TABLE "asset_depreciation_schedules"
    ADD COLUMN "assetFinanceBookId" TEXT;

UPDATE "asset_depreciation_schedules" AS schedule
SET "assetFinanceBookId" = book."id"
FROM "asset_finance_books" AS book
WHERE book."assetId" = schedule."assetId";

ALTER TABLE "asset_depreciation_schedules"
    ALTER COLUMN "adjustmentId" DROP NOT NULL,
    ALTER COLUMN "assetFinanceBookId" SET NOT NULL;

ALTER TABLE "asset_depreciation_schedules"
    DROP CONSTRAINT "asset_depreciation_schedules_adjustmentId_fkey",
    ADD CONSTRAINT "asset_depreciation_schedules_adjustmentId_fkey"
    FOREIGN KEY ("adjustmentId") REFERENCES "asset_value_adjustments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "asset_depreciation_schedules_assetFinanceBookId_fkey"
    FOREIGN KEY ("assetFinanceBookId") REFERENCES "asset_finance_books"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "asset_depreciation_schedules_assetFinanceBookId_idx"
    ON "asset_depreciation_schedules"("assetFinanceBookId");
CREATE INDEX "asset_depreciation_schedules_assetFinanceBookId_status_idx"
    ON "asset_depreciation_schedules"("assetFinanceBookId", "status");
-- PostgreSQL partial uniqueness expresses the lifecycle invariant Prisma cannot model.
CREATE UNIQUE INDEX "asset_depreciation_schedules_one_open_per_book_key"
    ON "asset_depreciation_schedules"("assetFinanceBookId")
    WHERE "status" IN ('DRAFT', 'ACTIVE');

CREATE TABLE "asset_depreciation_journal_entries" (
    "id" TEXT NOT NULL,
    "series" VARCHAR(50) NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetFinanceBookId" TEXT NOT NULL,
    "company" VARCHAR(255) NOT NULL,
    "financeBookName" VARCHAR(255) NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "depreciationAmount" DECIMAL(18,6) NOT NULL,
    "remarks" VARCHAR(500),
    "status" "AssetDepreciationJournalEntryStatus" NOT NULL DEFAULT 'POSTED',
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_depreciation_journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_depreciation_journal_entry_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "lineType" "AssetRevaluationLineType" NOT NULL,
    "account" VARCHAR(255) NOT NULL,
    "debitAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "costCenter" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_depreciation_journal_entry_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_depreciation_journal_entries_series_key"
    ON "asset_depreciation_journal_entries"("series");
-- This is the authoritative exactly-once guard, independent of BullMQ retention.
CREATE UNIQUE INDEX "asset_depreciation_journal_entries_assetFinanceBookId_postingDate_key"
    ON "asset_depreciation_journal_entries"("assetFinanceBookId", "postingDate");
CREATE INDEX "asset_depreciation_journal_entries_assetId_idx"
    ON "asset_depreciation_journal_entries"("assetId");
CREATE INDEX "asset_depreciation_journal_entries_postingDate_idx"
    ON "asset_depreciation_journal_entries"("postingDate");
CREATE INDEX "asset_depreciation_journal_entries_status_idx"
    ON "asset_depreciation_journal_entries"("status");
CREATE INDEX "asset_depreciation_journal_entry_lines_journalEntryId_idx"
    ON "asset_depreciation_journal_entry_lines"("journalEntryId");
CREATE INDEX "asset_depreciation_journal_entry_lines_account_idx"
    ON "asset_depreciation_journal_entry_lines"("account");

ALTER TABLE "asset_depreciation_journal_entries"
    ADD CONSTRAINT "asset_depreciation_journal_entries_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "assets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "asset_depreciation_journal_entries_assetFinanceBookId_fkey"
    FOREIGN KEY ("assetFinanceBookId") REFERENCES "asset_finance_books"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_depreciation_journal_entry_lines"
    ADD CONSTRAINT "asset_depreciation_journal_entry_lines_journalEntryId_fkey"
    FOREIGN KEY ("journalEntryId") REFERENCES "asset_depreciation_journal_entries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_depreciation_schedule_entries"
    ADD COLUMN "postingId" TEXT,
    ADD COLUMN "postedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "asset_depreciation_schedule_entries_postingId_key"
    ON "asset_depreciation_schedule_entries"("postingId");

ALTER TABLE "asset_depreciation_schedule_entries"
    ADD CONSTRAINT "asset_depreciation_schedule_entries_postingId_fkey"
    FOREIGN KEY ("postingId") REFERENCES "asset_depreciation_journal_entries"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
