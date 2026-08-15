-- R-009: preserve the complete finance-book depreciation configuration used
-- to generate immutable schedules. Defaults are intentionally explicit for
-- historical rows; legacy shift-based books without allocation rows fail
-- closed when a schedule must be generated rather than assuming factor 1.

ALTER TABLE "asset_finance_books"
  ADD COLUMN "precision" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "ratePrecision" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "calculateUsingTotalDays" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "asset_category_finance_books"
  ADD COLUMN "precision" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "ratePrecision" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "calculateUsingTotalDays" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "asset_depreciation_schedules"
  ADD COLUMN "precision" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "ratePrecision" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "calculateUsingTotalDays" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "asset_depreciation_schedule_entries"
  ADD COLUMN "shift" VARCHAR(100);

CREATE TABLE "asset_finance_book_shift_allocations" (
  "id" TEXT NOT NULL,
  "assetFinanceBookId" TEXT NOT NULL,
  "periodIndex" INTEGER NOT NULL,
  "shift" VARCHAR(100) NOT NULL,
  "factor" DECIMAL(9,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "asset_finance_book_shift_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_category_finance_book_shift_allocations" (
  "id" TEXT NOT NULL,
  "assetCategoryFinanceBookId" TEXT NOT NULL,
  "periodIndex" INTEGER NOT NULL,
  "shift" VARCHAR(100) NOT NULL,
  "factor" DECIMAL(9,6) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "asset_category_finance_book_shift_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_finance_book_shift_period_key"
  ON "asset_finance_book_shift_allocations"("assetFinanceBookId", "periodIndex");
CREATE INDEX "asset_finance_book_shift_book_idx"
  ON "asset_finance_book_shift_allocations"("assetFinanceBookId");

CREATE UNIQUE INDEX "asset_category_shift_period_key"
  ON "asset_category_finance_book_shift_allocations"("assetCategoryFinanceBookId", "periodIndex");
CREATE INDEX "asset_category_shift_book_idx"
  ON "asset_category_finance_book_shift_allocations"("assetCategoryFinanceBookId");

ALTER TABLE "asset_finance_book_shift_allocations"
  ADD CONSTRAINT "asset_finance_book_shift_allocations_assetFinanceBookId_fkey"
  FOREIGN KEY ("assetFinanceBookId") REFERENCES "asset_finance_books"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_category_finance_book_shift_allocations"
  ADD CONSTRAINT "asset_category_finance_book_shift_allocations_assetCategoryFinanceBookId_fkey"
  FOREIGN KEY ("assetCategoryFinanceBookId") REFERENCES "asset_category_finance_books"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
