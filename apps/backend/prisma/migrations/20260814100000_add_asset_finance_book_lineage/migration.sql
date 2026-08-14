-- R-005: persist the selected finance-book context on book-sensitive asset
-- documents and their Asset-domain accounting/revaluation lineage.
-- Existing rows remain nullable because the preceding migration deliberately
-- leaves ambiguous legacy value adjustments unbooked rather than guessing.

ALTER TABLE "asset_revaluation_entries"
  ADD COLUMN "financeBookId" TEXT;

ALTER TABLE "asset_accounting_entries"
  ADD COLUMN "financeBookId" TEXT;

ALTER TABLE "asset_capitalizations"
  ADD COLUMN "financeBookId" TEXT;

ALTER TABLE "asset_capitalizations"
  ADD COLUMN "targetPreviousFinanceBookValue" DECIMAL(18,6);

ALTER TABLE "asset_capitalizations"
  ADD COLUMN "targetPreviousCalculateDepreciation" BOOLEAN;

ALTER TABLE "asset_capitalizations"
  ADD COLUMN "targetFinanceBookCreated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "asset_capitalizations"
  ADD COLUMN "targetFinanceBookScheduleCreated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "asset_capitalization_asset_items"
  ADD COLUMN "financeBookId" TEXT;

ALTER TABLE "asset_disposals"
  ADD COLUMN "financeBookId" TEXT;

CREATE INDEX "asset_revaluation_entries_financeBookId_idx"
  ON "asset_revaluation_entries"("financeBookId");
CREATE INDEX "asset_accounting_entries_financeBookId_idx"
  ON "asset_accounting_entries"("financeBookId");
CREATE INDEX "asset_capitalizations_financeBookId_idx"
  ON "asset_capitalizations"("financeBookId");
CREATE INDEX "asset_capitalization_asset_items_financeBookId_idx"
  ON "asset_capitalization_asset_items"("financeBookId");
CREATE INDEX "asset_disposals_financeBookId_idx"
  ON "asset_disposals"("financeBookId");

ALTER TABLE "asset_revaluation_entries"
  ADD CONSTRAINT "asset_revaluation_entries_financeBookId_fkey"
  FOREIGN KEY ("financeBookId") REFERENCES "finance_books"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_accounting_entries"
  ADD CONSTRAINT "asset_accounting_entries_financeBookId_fkey"
  FOREIGN KEY ("financeBookId") REFERENCES "finance_books"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_capitalizations"
  ADD CONSTRAINT "asset_capitalizations_financeBookId_fkey"
  FOREIGN KEY ("financeBookId") REFERENCES "finance_books"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_capitalization_asset_items"
  ADD CONSTRAINT "asset_capitalization_asset_items_financeBookId_fkey"
  FOREIGN KEY ("financeBookId") REFERENCES "finance_books"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_disposals"
  ADD CONSTRAINT "asset_disposals_financeBookId_fkey"
  FOREIGN KEY ("financeBookId") REFERENCES "finance_books"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
