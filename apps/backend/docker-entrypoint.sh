#!/bin/sh
set -e

# Official Prisma Migrate Production Entrypoint
# Reference: https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
# Reference: https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production
#
# This script handles the "baselining" scenario where an existing database
# needs to be transitioned from 'prisma db push' to 'prisma migrate' workflow.

echo "🚀 Starting Aria Backend..."
echo "📦 Working directory: $(pwd)"
echo "📂 Migrations location: ./prisma/migrations"

# For existing databases transitioning to Prisma Migrate:
# 1. The 0_init migration contains the complete schema DDL
# 2. If tables already exist, Prisma will fail with P3018 (type/table already exists)
# 3. We must mark 0_init as "applied" before running migrate deploy
#
# This approach follows the official Prisma baselining workflow documented at:
# https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining

BASELINE_MIGRATION="0_init"

echo "🔍 Checking if baseline migration needs resolution..."

# Attempt to deploy migrations first
# If it fails with P3018 (already exists) or P3009 (failed migration), 
# we know we need to resolve the baseline
if ! npx prisma migrate deploy 2>&1 | tee /tmp/migrate-output.log; then
  MIGRATE_OUTPUT=$(cat /tmp/migrate-output.log)
  
  # Check for P3018 (already exists) - indicates database has existing schema
  if echo "$MIGRATE_OUTPUT" | grep -q "P3018"; then
    echo "⚠️  P3018 Error: Database schema already exists (expected for existing databases)"
    echo "🔧 Applying baseline migration resolution..."
    echo "📋 Marking '${BASELINE_MIGRATION}' as already applied..."
    
    # Mark the baseline migration as applied without executing it
    if npx prisma migrate resolve --applied "${BASELINE_MIGRATION}"; then
      echo "✅ Baseline migration marked as applied"
      echo "📦 Re-attempting migration deployment..."
      
      # Now deploy should succeed (no pending migrations after baseline resolution)
      if ! npx prisma migrate deploy; then
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
    if npx prisma migrate resolve --applied "${BASELINE_MIGRATION}"; then
      echo "✅ Failed migration state resolved"
      echo "📦 Re-attempting migration deployment..."
      
      if ! npx prisma migrate deploy; then
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

echo "✅ Migration deployment complete"
echo "🎯 Starting NestJS application..."

# Start the application
exec node dist/main
