ALTER TABLE "asset_capitalizations"
  ADD COLUMN "targetPreviousFinanceBookSnapshot" JSONB,
  ADD COLUMN "targetPreviousIsFullyDepreciated" BOOLEAN;

ALTER TABLE "asset_capitalization_asset_items"
  ADD COLUMN "previousIsFullyDepreciated" BOOLEAN,
  ADD COLUMN "closedScheduleId" TEXT;

ALTER TABLE "asset_depreciation_schedules"
  ADD COLUMN "sourceCapitalizationId" TEXT,
  ADD COLUMN "closedByCapitalizationId" TEXT;

ALTER TABLE "asset_depreciation_journal_entries"
  ADD COLUMN "sourceCapitalizationId" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "asset_capitalizations" AS capitalization
    LEFT JOIN "assets" AS target ON target."id" = capitalization."targetAssetId"
    WHERE capitalization."targetAssetId" IS NOT NULL
      AND target."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'R-011 failed closed: existing capitalization target orphan detected';
  END IF;
END
$$;

ALTER TABLE "asset_capitalizations"
  DROP CONSTRAINT "asset_capitalizations_targetAssetId_fkey";

ALTER TABLE "asset_capitalizations"
  ADD CONSTRAINT "asset_capitalizations_targetAssetId_fkey"
  FOREIGN KEY ("targetAssetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "asset_capitalizations_targetAssetId_idx"
  ON "asset_capitalizations"("targetAssetId");

CREATE INDEX "asset_depreciation_schedules_sourceCapitalizationId_idx"
  ON "asset_depreciation_schedules"("sourceCapitalizationId");

CREATE INDEX "asset_depreciation_schedules_closedByCapitalizationId_idx"
  ON "asset_depreciation_schedules"("closedByCapitalizationId");

CREATE INDEX "asset_depreciation_journal_entries_sourceCapitalizationId_idx"
  ON "asset_depreciation_journal_entries"("sourceCapitalizationId");

CREATE INDEX "asset_capitalization_asset_items_closedScheduleId_idx"
  ON "asset_capitalization_asset_items"("closedScheduleId");

ALTER TABLE "asset_depreciation_schedules"
  ADD CONSTRAINT "asset_depreciation_schedules_sourceCapitalizationId_fkey"
  FOREIGN KEY ("sourceCapitalizationId") REFERENCES "asset_capitalizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "asset_depreciation_schedules_closedByCapitalizationId_fkey"
  FOREIGN KEY ("closedByCapitalizationId") REFERENCES "asset_capitalizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_depreciation_journal_entries"
  ADD CONSTRAINT "asset_depreciation_journal_entries_sourceCapitalizationId_fkey"
  FOREIGN KEY ("sourceCapitalizationId") REFERENCES "asset_capitalizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
