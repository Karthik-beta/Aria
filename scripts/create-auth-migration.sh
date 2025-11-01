#!/usr/bin/env bash
# Script to create Prisma migration for authentication tables
# Run this before deploying to production

set -e

echo "Creating Prisma migration for Better Auth tables..."

cd apps/backend

# Generate Prisma client
echo "Generating Prisma client..."
bun prisma generate

# Create migration (will be applied automatically in docker-compose)
echo "Creating migration SQL..."
bun prisma migrate dev --name add_better_auth_tables --create-only

echo "✅ Migration created successfully!"
echo ""
echo "Next steps:"
echo "1. Review the migration in apps/backend/prisma/migrations/"
echo "2. Commit the migration files to git"
echo "3. Deploy with: docker compose -f docker-compose.production.yml up -d"
echo "4. Migrations will be applied automatically on startup"
