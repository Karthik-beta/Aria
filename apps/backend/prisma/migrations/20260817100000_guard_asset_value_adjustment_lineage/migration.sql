-- R-014: persist the selected finance-book state version captured by a value
-- adjustment. Existing adjustments remain nullable and are handled
-- conservatively by the cancellation workflow until they are resubmitted.

ALTER TABLE "asset_finance_books"
  ADD COLUMN "stateVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "asset_value_adjustments"
  ADD COLUMN "previousFinanceBookStateVersion" INTEGER,
  ADD COLUMN "submittedFinanceBookStateVersion" INTEGER;
