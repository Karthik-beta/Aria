#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

database_url_without_query=${DATABASE_URL%%\?*}
database_url_prefix=${database_url_without_query%/*}
admin_url="${database_url_prefix}/postgres"
fresh_url="${database_url_prefix}/aria_depreciation_fresh"
legacy_url="${database_url_prefix}/aria_depreciation_legacy"
depreciation_migration="20260715120000_add_reliable_asset_depreciation"
temporary_migrations=$(mktemp -d)

cleanup() {
  psql "$admin_url" -v ON_ERROR_STOP=1 \
    -c 'DROP DATABASE IF EXISTS aria_depreciation_fresh WITH (FORCE)' \
    -c 'DROP DATABASE IF EXISTS aria_depreciation_legacy WITH (FORCE)' >/dev/null
  rm -rf "$temporary_migrations"
}
trap cleanup EXIT

psql "$admin_url" -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS aria_depreciation_fresh WITH (FORCE)' \
  -c 'DROP DATABASE IF EXISTS aria_depreciation_legacy WITH (FORCE)' \
  -c 'CREATE DATABASE aria_depreciation_fresh' \
  -c 'CREATE DATABASE aria_depreciation_legacy' >/dev/null

cp prisma/migrations/migration_lock.toml "$temporary_migrations/"
for migration in prisma/migrations/*; do
  migration_name=$(basename "$migration")
  if [ -d "$migration" ] && ! [ "$migration_name" \> "$depreciation_migration" ]; then
    cp -R "$migration" "$temporary_migrations/"
  fi
done

DATABASE_URL="$fresh_url" \
PRISMA_MIGRATIONS_PATH="$(pwd)/prisma/migrations" \
  bun x --bun prisma migrate deploy --config prisma/migration-test.config.ts

DATABASE_URL="$legacy_url" \
PRISMA_MIGRATIONS_PATH="$temporary_migrations" \
  bun x --bun prisma migrate deploy --config prisma/migration-test.config.ts

psql "$legacy_url" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "Company" ("id", "name", "updatedAt")
VALUES ('legacy-company', 'Legacy Company', CURRENT_TIMESTAMP);

INSERT INTO "asset_categories" (
  "id", "name", "depreciationMethod", "totalNumberOfDepreciations",
  "frequencyOfDepreciation", "updatedAt"
) VALUES (
  'legacy-category', 'Legacy Category', 'STRAIGHT_LINE', 12, 1,
  CURRENT_TIMESTAMP
);

INSERT INTO "assets" (
  "id", "series", "assetName", "itemCode", "assetCategoryId", "company",
  "purchaseDate", "availableForUseDate", "netPurchaseAmount",
  "calculateDepreciation", "depreciationMethod",
  "totalNumberOfDepreciations", "frequencyOfDepreciation",
  "depreciationStartDate", "valueAfterDepreciation", "status", "updatedAt"
) VALUES (
  'legacy-asset', 'AST-LEGACY-1', 'Legacy Asset', 'LEGACY-ITEM',
  'legacy-category', 'Legacy Company', DATE '2025-01-01', DATE '2025-01-01',
  1200, true, 'STRAIGHT_LINE', 12, 1, DATE '2025-02-01', 1200,
  'SUBMITTED', CURRENT_TIMESTAMP
);

INSERT INTO "asset_finance_books" (
  "id", "assetId", "financeBookId", "depreciationMethod",
  "totalNumberOfDepreciations", "frequencyOfDepreciation",
  "depreciationStartDate", "updatedAt"
) VALUES (
  'legacy-book', 'legacy-asset',
  (SELECT "id" FROM "finance_books" ORDER BY "createdAt", "id" LIMIT 1),
  'STRAIGHT_LINE', 12, 1, DATE '2025-02-01', CURRENT_TIMESTAMP
);

INSERT INTO "asset_value_adjustments" (
  "id", "series", "assetId", "companySnapshot", "adjustmentDate",
  "currentAssetValue", "newAssetValue", "differenceAmount",
  "differenceAccount", "fixedAssetAccount", "status", "direction",
  "previousAssetStatus", "updatedAt"
) VALUES (
  'legacy-adjustment', 'AVA-LEGACY-1', 'legacy-asset', 'Legacy Company',
  DATE '2025-01-01', 1200, 1200, 0, 'Adjustment', 'Fixed Asset',
  'SUBMITTED', 'INCREASE', 'SUBMITTED', CURRENT_TIMESTAMP
);

INSERT INTO "asset_depreciation_schedules" (
  "id", "adjustmentId", "assetId", "assetFinanceBookId", "revisionNumber", "status", "startDate",
  "depreciationMethod", "totalNumberOfDepreciations",
  "frequencyOfDepreciation", "bookedDepreciations",
  "remainingDepreciations", "baseAssetValue", "updatedAt"
) VALUES (
  'legacy-schedule', 'legacy-adjustment', 'legacy-asset', 'legacy-book', 1, 'ACTIVE',
  DATE '2025-02-01', 'STRAIGHT_LINE', 12, 1, 0, 12, 1200,
  CURRENT_TIMESTAMP
);

INSERT INTO "asset_depreciation_schedule_entries" (
  "id", "scheduleId", "sequence", "scheduleDate", "depreciationAmount",
  "accumulatedDepreciationAmount", "bookValueAfterDepreciation", "updatedAt"
) VALUES (
  'legacy-entry', 'legacy-schedule', 1, DATE '2025-02-01', 100, 100,
  1100, CURRENT_TIMESTAMP
);
SQL

DATABASE_URL="$legacy_url" \
PRISMA_MIGRATIONS_PATH="$(pwd)/prisma/migrations" \
  bun x --bun prisma migrate deploy --config prisma/migration-test.config.ts

psql "$legacy_url" -v ON_ERROR_STOP=1 -tAc "
DO \$\$
BEGIN
  IF (SELECT COUNT(*) FROM \"finance_books\") <> 1 THEN
    RAISE EXCEPTION 'default finance book was not created';
  END IF;
  IF (SELECT COUNT(*) FROM \"asset_finance_books\" WHERE \"assetId\" = 'legacy-asset') <> 1 THEN
    RAISE EXCEPTION 'legacy asset finance book was not backfilled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM \"asset_depreciation_schedules\"
    WHERE \"id\" = 'legacy-schedule' AND \"assetFinanceBookId\" IS NULL
  ) THEN
    RAISE EXCEPTION 'legacy schedule was not linked to its finance book';
  END IF;
  IF (SELECT COUNT(*) FROM \"asset_depreciation_journal_entries\") <> 0 THEN
    RAISE EXCEPTION 'migration created depreciation journals';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'asset_depreciation_schedules_one_open_per_book_key'
  ) THEN
    RAISE EXCEPTION 'open-schedule uniqueness index is missing';
  END IF;
  IF to_regclass('public.asset_movements') IS NULL
     OR to_regclass('public.asset_repairs') IS NULL
     OR to_regclass('public.asset_capitalizations') IS NULL
     OR to_regclass('public.asset_disposals') IS NULL
     OR to_regclass('public.asset_accounting_entries') IS NULL THEN
    RAISE EXCEPTION 'asset lifecycle tables are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.asset_finance_books'::regclass
      AND attname = 'increaseInAssetLife'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'asset finance-book repair-life column is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.asset_value_adjustments'::regclass
      AND attname = 'financeBookId'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'asset value-adjustment finance-book column is missing';
  END IF;
END
\$\$;
"

echo "Fresh and legacy depreciation migration tests passed."
