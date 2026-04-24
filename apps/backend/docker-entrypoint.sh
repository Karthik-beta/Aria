#!/bin/sh
set -e


# Official Prisma Migrate Production Entrypoint 🛡️
# References:
#   - https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
#   - https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
#
# Purpose: Safely handle the "baselining" scenario where an existing database
# (created previously with `prisma db push` or similar) is transitioned to
# the `prisma migrate` workflow. This script follows Prisma's recommended
# baselining workflow and attempts to mark the initial migration as applied
# when appropriate before deploying migrations. Use with caution in production. ⚠️

echo "🚀 Starting Aria Backend..."

# Change to backend directory where Prisma schema is located
cd /app/apps/backend

echo "📦 Working directory: $(pwd)"
echo "📂 Migrations location: ./prisma/migrations"
echo "📝 Note: This entrypoint will attempt to deploy migrations and resolve baselines if needed."

# Document directory structure assumption:
# The Dockerfile copies build artifacts to /app/apps/backend/dist
# NestJS by default outputs to dist/main.js, so we run: bun dist/main.js
# (This path is relative to the current /app/apps/backend directory)

# For existing databases transitioning to Prisma Migrate:
# 1. The 0_init migration contains the complete schema DDL
# 2. If tables already exist, Prisma will fail with P3018 (type/table already exists)
# 3. We must mark 0_init as "applied" before running migrate deploy
#
# This approach follows the official Prisma baselining workflow documented at:
# https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining

# The migration name we treat as the baseline (initial schema/DDL)
BASELINE_MIGRATION="0_init"

echo "ℹ️ Skipping Prisma Client generation at runtime (already generated during image build)."

# Debug: Print DATABASE_URL if set (sanitized)
if [ -n "$DATABASE_URL" ]; then
  echo "✅ DATABASE_URL is set (length: ${#DATABASE_URL})"
else
  echo "⚠️ DATABASE_URL is NOT set - Railway env vars may not be passed correctly"
fi

# Check if DATABASE_URL is available before running migrations
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️ DATABASE_URL not set - skipping migration and starting app directly"
  echo "🎯 Starting NestJS application..."
  exec bun dist/main.js
fi

echo "🔍 Checking if baseline migration needs resolution... (baselining strategy)"

# Attempt to deploy migrations first
# If it fails with P3018 (already exists) or P3009 (failed migration),
# we know we need to resolve the baseline
if ! bunx --bun prisma migrate deploy > /tmp/migrate-output.log 2>&1; then
  MIGRATE_OUTPUT=$(cat /tmp/migrate-output.log)

  # Check for P3018 (already exists) - indicates database has existing schema
  if echo "$MIGRATE_OUTPUT" | grep -q "P3018"; then
    echo "⚠️  P3018 Error: Database schema already exists (expected for existing databases)"
    echo "🔧 Applying baseline migration resolution..."
    echo "📋 Marking '${BASELINE_MIGRATION}' as already applied..."

    # Mark the baseline migration as applied without executing it
    if bunx --bun prisma migrate resolve --applied "${BASELINE_MIGRATION}"; then
      echo "✅ Baseline migration marked as applied"
      echo "📦 Re-attempting migration deployment..."

      # Now deploy should succeed (no pending migrations after baseline resolution)
      if ! bunx --bun prisma migrate deploy; then
        echo "❌ Migration deployment failed after baseline resolution"
        echo "📋 Migration logs:"
        cat /tmp/migrate-output.log
        exit 1
      fi
    else
      echo "❌ Failed to resolve baseline migration"
      exit 1
    fi

  # Check for P3009 (failed migration) - indicates previous failed attempt
  elif echo "$MIGRATE_OUTPUT" | grep -q "P3009"; then
    echo "⚠️  P3009 Error: Failed migration detected in history"
    echo "🔧 Resolving failed migration state..."
    echo "📋 Marking '${BASELINE_MIGRATION}' as applied..."

    # Mark the baseline migration as applied to clear failed state
    if bunx --bun prisma migrate resolve --applied "${BASELINE_MIGRATION}"; then
      echo "✅ Failed migration state resolved"
      echo "📦 Re-attempting migration deployment..."

      if ! bunx --bun prisma migrate deploy; then
        echo "❌ Migration deployment failed after resolving failed state"
        exit 1
      fi
    else
      echo "❌ Failed to resolve migration state"
      exit 1
    fi

  else
    # Unknown migration error
    echo "❌ Migration deployment failed with unexpected error:"
    cat /tmp/migrate-output.log
    exit 1
  fi
else
  # migrate deploy succeeded on first attempt
  echo "✅ All migrations applied successfully"
fi

# Load optional demo data
if [ -n "$LOAD_DEMO_DATA" ]; then
  echo "📊 Loading demo data (scale=${LOAD_DEMO_DATA_SCALE:-medium})..."
  bun prisma/demo-data/cli.ts load --scale=${LOAD_DEMO_DATA_SCALE:-medium}
  echo "✅ Demo data loaded"
fi

echo "🎯 Starting NestJS application..."

# Start the application (already in /app/apps/backend directory)
exec bun dist/main.js
