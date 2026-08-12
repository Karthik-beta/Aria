-- R-001 final architecture: Organization -> Company -> Asset.
--
-- This repository's prior R-001 implementation was never committed or
-- applied as a release migration. The final migration therefore deliberately
-- creates the ID-based schema from an empty previous migration head. It fails
-- closed when disposable pre-R-001 data is present instead of guessing a
-- tenant or preserving name-based ownership compatibility.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Company" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "assets" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "asset_value_adjustments" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "asset_revaluation_entries" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "asset_depreciation_journal_entries" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "asset_accounting_entries" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "asset_maintenance_teams" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "asset_maintenances" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "asset_movements" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "asset_repairs" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "asset_capitalizations" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "asset_disposals" LIMIT 1) THEN
    RAISE EXCEPTION USING MESSAGE =
      'R-001 failed closed: pre-R-001 Company or Asset-domain data exists. Recreate disposable development data or run an approved data migration before applying the final architecture.';
  END IF;
END $$;

ALTER TABLE "Company"
  ADD COLUMN "organizationId" TEXT;

ALTER TABLE "assets"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "asset_revaluation_entries"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "asset_depreciation_journal_entries"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "asset_accounting_entries"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "asset_maintenance_teams"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "asset_maintenances"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "asset_movements"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "asset_repairs"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "asset_capitalizations"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "asset_disposals"
  ADD COLUMN "companyId" TEXT;

DROP INDEX IF EXISTS "Company_name_key";
DROP INDEX IF EXISTS "Company_organizationId_name_key";
DROP INDEX IF EXISTS "assets_company_idx";
DROP INDEX IF EXISTS "asset_value_adjustments_companySnapshot_idx";
DROP INDEX IF EXISTS "asset_maintenance_teams_company_idx";
DROP INDEX IF EXISTS "asset_maintenances_company_idx";
DROP INDEX IF EXISTS "asset_movements_company_idx";
DROP INDEX IF EXISTS "asset_movements_company_status_transactionDate_idx";
DROP INDEX IF EXISTS "asset_repairs_company_idx";
DROP INDEX IF EXISTS "asset_capitalizations_company_idx";
DROP INDEX IF EXISTS "asset_disposals_company_idx";
DROP INDEX IF EXISTS "asset_accounting_entries_company_postingDate_status_idx";

ALTER TABLE "assets" DROP COLUMN "company";
ALTER TABLE "asset_value_adjustments" DROP COLUMN "companySnapshot";
ALTER TABLE "asset_revaluation_entries" DROP COLUMN "company";
ALTER TABLE "asset_depreciation_journal_entries" DROP COLUMN "company";
ALTER TABLE "asset_accounting_entries" DROP COLUMN "company";
ALTER TABLE "asset_maintenance_teams" DROP COLUMN "company";
ALTER TABLE "asset_maintenances" DROP COLUMN "company";
ALTER TABLE "asset_movements" DROP COLUMN "company";
ALTER TABLE "asset_repairs" DROP COLUMN "company";
ALTER TABLE "asset_capitalizations" DROP COLUMN "company";
ALTER TABLE "asset_disposals" DROP COLUMN "company";

ALTER TABLE "Company" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "assets" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "asset_revaluation_entries" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "asset_depreciation_journal_entries" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "asset_accounting_entries" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "asset_maintenance_teams" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "asset_maintenances" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "asset_movements" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "asset_repairs" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "asset_capitalizations" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "asset_disposals" ALTER COLUMN "companyId" SET NOT NULL;

CREATE UNIQUE INDEX "Company_organizationId_name_key"
  ON "Company"("organizationId", "name");
CREATE INDEX "Company_organizationId_idx"
  ON "Company"("organizationId");
CREATE INDEX "assets_companyId_idx"
  ON "assets"("companyId");
CREATE INDEX "assets_companyId_status_purchaseDate_idx"
  ON "assets"("companyId", "status", "purchaseDate");
CREATE INDEX "asset_revaluation_entries_companyId_idx"
  ON "asset_revaluation_entries"("companyId");
CREATE INDEX "asset_depreciation_journal_entries_companyId_idx"
  ON "asset_depreciation_journal_entries"("companyId");
CREATE INDEX "asset_accounting_entries_companyId_postingDate_status_idx"
  ON "asset_accounting_entries"("companyId", "postingDate", "status");
CREATE INDEX "asset_maintenance_teams_companyId_idx"
  ON "asset_maintenance_teams"("companyId");
CREATE INDEX "asset_maintenances_companyId_idx"
  ON "asset_maintenances"("companyId");
CREATE INDEX "asset_movements_companyId_idx"
  ON "asset_movements"("companyId");
CREATE INDEX "asset_movements_companyId_status_transactionDate_idx"
  ON "asset_movements"("companyId", "status", "transactionDate");
CREATE INDEX "asset_repairs_companyId_idx"
  ON "asset_repairs"("companyId");
CREATE INDEX "asset_capitalizations_companyId_idx"
  ON "asset_capitalizations"("companyId");
CREATE INDEX "asset_disposals_companyId_idx"
  ON "asset_disposals"("companyId");

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assets"
  ADD CONSTRAINT "assets_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_revaluation_entries"
  ADD CONSTRAINT "asset_revaluation_entries_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_depreciation_journal_entries"
  ADD CONSTRAINT "asset_depreciation_journal_entries_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_accounting_entries"
  ADD CONSTRAINT "asset_accounting_entries_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_maintenance_teams"
  ADD CONSTRAINT "asset_maintenance_teams_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_maintenances"
  ADD CONSTRAINT "asset_maintenances_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_movements"
  ADD CONSTRAINT "asset_movements_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_repairs"
  ADD CONSTRAINT "asset_repairs_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_capitalizations"
  ADD CONSTRAINT "asset_capitalizations_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_disposals"
  ADD CONSTRAINT "asset_disposals_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
