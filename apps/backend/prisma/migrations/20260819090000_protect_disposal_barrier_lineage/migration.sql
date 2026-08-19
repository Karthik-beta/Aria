ALTER TABLE "asset_depreciation_schedules"
  ADD COLUMN "closedByDisposalId" TEXT;

ALTER TABLE "asset_depreciation_journal_entries"
  ADD COLUMN "sourceDisposalId" TEXT;

ALTER TABLE "asset_disposals"
  ADD COLUMN "submittedFinanceBookStateVersion" INTEGER;

CREATE INDEX "asset_depreciation_schedules_closedByDisposalId_idx"
  ON "asset_depreciation_schedules"("closedByDisposalId");

CREATE INDEX "asset_depreciation_journal_entries_sourceDisposalId_idx"
  ON "asset_depreciation_journal_entries"("sourceDisposalId");

ALTER TABLE "asset_depreciation_schedules"
  ADD CONSTRAINT "asset_depreciation_schedules_closedByDisposalId_fkey"
  FOREIGN KEY ("closedByDisposalId") REFERENCES "asset_disposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_depreciation_journal_entries"
  ADD CONSTRAINT "asset_depreciation_journal_entries_sourceDisposalId_fkey"
  FOREIGN KEY ("sourceDisposalId") REFERENCES "asset_disposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
