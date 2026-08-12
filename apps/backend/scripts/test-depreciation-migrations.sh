#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

database_url_without_query=${DATABASE_URL%%\?*}
database_url_prefix=${database_url_without_query%/*}
admin_url="${database_url_prefix}/postgres"
fresh_url="${database_url_prefix}/aria_r001_fresh"
upgrade_url="${database_url_prefix}/aria_r001_upgrade_empty"
ambiguous_url="${database_url_prefix}/aria_r001_ambiguous"
r001_migration="20260811100000_add_asset_organization_ownership"
temporary_root=$(mktemp -d)
previous_migrations="$temporary_root/previous-migrations"
failure_output="$temporary_root/failure-output"

cleanup() {
  psql "$admin_url" -v ON_ERROR_STOP=1 \
    -c 'DROP DATABASE IF EXISTS aria_r001_fresh WITH (FORCE)' \
    -c 'DROP DATABASE IF EXISTS aria_r001_upgrade_empty WITH (FORCE)' \
    -c 'DROP DATABASE IF EXISTS aria_r001_ambiguous WITH (FORCE)' >/dev/null
  rm -rf "$temporary_root"
}
trap cleanup EXIT

psql "$admin_url" -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS aria_r001_fresh WITH (FORCE)' \
  -c 'DROP DATABASE IF EXISTS aria_r001_upgrade_empty WITH (FORCE)' \
  -c 'DROP DATABASE IF EXISTS aria_r001_ambiguous WITH (FORCE)' \
  -c 'CREATE DATABASE aria_r001_fresh' \
  -c 'CREATE DATABASE aria_r001_upgrade_empty' \
  -c 'CREATE DATABASE aria_r001_ambiguous' >/dev/null

mkdir -p "$previous_migrations"
cp prisma/migrations/migration_lock.toml "$previous_migrations/"
for migration in prisma/migrations/*; do
  migration_name=$(basename "$migration")
  if [ -d "$migration" ] && [ "$migration_name" \< "$r001_migration" ]; then
    cp -R "$migration" "$previous_migrations/"
  fi
done

assert_final_schema() {
  database_url=$1
  psql "$database_url" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  asset_domain_table TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Company' AND column_name = 'organizationId'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Company.organizationId is not a required column';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'companyId'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'assets.companyId is not a required column';
  END IF;

  FOREACH asset_domain_table IN ARRAY ARRAY[
    'asset_revaluation_entries',
    'asset_depreciation_journal_entries',
    'asset_accounting_entries',
    'asset_maintenance_teams',
    'asset_maintenances',
    'asset_movements',
    'asset_repairs',
    'asset_capitalizations',
    'asset_disposals'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = asset_domain_table
        AND column_name = 'companyId'
        AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION '% companyId is not a required column', asset_domain_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = asset_domain_table
        AND column_name = 'company'
    ) THEN
      RAISE EXCEPTION '% retains the legacy free-text company column', asset_domain_table;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'company'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'asset_value_adjustments'
      AND column_name = 'companySnapshot'
  ) THEN
    RAISE EXCEPTION 'legacy Asset ownership columns remain';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Company_name_key'
  ) THEN
    RAISE EXCEPTION 'global Company.name uniqueness remains';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'Company_organizationId_name_key'
  ) THEN
    RAISE EXCEPTION 'organization-scoped Company uniqueness is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Company_organizationId_fkey'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assets_companyId_fkey'
  ) THEN
    RAISE EXCEPTION 'canonical Organization -> Company -> Asset foreign keys are missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'assets_companyId_status_purchaseDate_idx'
  ) THEN
    RAISE EXCEPTION 'Asset Company query index is missing';
  END IF;
END
$$;
SQL
}

DATABASE_URL="$fresh_url" \
PRISMA_MIGRATIONS_PATH="$(pwd)/prisma/migrations" \
  bun x --bun prisma migrate deploy --config prisma/migration-test.config.ts
assert_final_schema "$fresh_url"

DATABASE_URL="$upgrade_url" \
PRISMA_MIGRATIONS_PATH="$previous_migrations" \
  bun x --bun prisma migrate deploy --config prisma/migration-test.config.ts

if [ "$(psql "$upgrade_url" -tAc "SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE \"migration_name\" = '$r001_migration'")" -ne 0 ]; then
  echo "The empty upgrade database unexpectedly recorded R-001 before the final step." >&2
  exit 1
fi

DATABASE_URL="$upgrade_url" \
PRISMA_MIGRATIONS_PATH="$(pwd)/prisma/migrations" \
  bun x --bun prisma migrate deploy --config prisma/migration-test.config.ts
assert_final_schema "$upgrade_url"

DATABASE_URL="$ambiguous_url" \
PRISMA_MIGRATIONS_PATH="$previous_migrations" \
  bun x --bun prisma migrate deploy --config prisma/migration-test.config.ts

psql "$ambiguous_url" -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO "organizations" ("id", "name", "slug") VALUES
  ('r001-org-a', 'R-001 Organization A', 'r001-org-a'),
  ('r001-org-b', 'R-001 Organization B', 'r001-org-b');

INSERT INTO "Company" ("id", "name", "updatedAt")
VALUES ('r001-ambiguous-company', 'Shared Legacy Company', CURRENT_TIMESTAMP);
SQL

if DATABASE_URL="$ambiguous_url" \
  PRISMA_MIGRATIONS_PATH="$(pwd)/prisma/migrations" \
  bun x --bun prisma migrate deploy --config prisma/migration-test.config.ts \
  >"$failure_output" 2>&1; then
  cat "$failure_output"
  echo "Non-empty/ambiguous R-001 migration unexpectedly succeeded." >&2
  exit 1
fi
cat "$failure_output"
if ! grep -Fq "R-001 failed closed" "$failure_output"; then
  echo "R-001 did not report its fail-closed non-empty-data condition." >&2
  exit 1
fi

psql "$ambiguous_url" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Company' AND column_name = 'organizationId'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'companyId'
  ) THEN
    RAISE EXCEPTION 'failed migration left partial canonical columns behind';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'company'
  ) THEN
    RAISE EXCEPTION 'failed migration did not roll back the legacy Asset column';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Company_name_key'
  ) THEN
    RAISE EXCEPTION 'failed migration did not roll back the global Company index';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "_prisma_migrations"
    WHERE "migration_name" = '20260811100000_add_asset_organization_ownership'
      AND "finished_at" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'failed migration was recorded as successfully applied';
  END IF;
END
$$;
SQL

echo "Fresh, empty-upgrade, true-ambiguous, and rollback migration tests passed."
