# Prisma Migrations in Docker - Production-Ready Guide

## Overview

This document explains the **production-ready** implementation of Prisma database migrations in Aria ERP Docker deployments, specifically handling the **existing database baselining scenario**.

**Official References:**

- [Baselining Existing Databases](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining)
- [Development & Production Workflows](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [Migrate Resolve CLI Reference](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-resolve)

## The Existing Database Problem

### Background: Why Manual Intervention Was Needed

The Aria backend initially used `prisma db push` for schema synchronization during development. When transitioning to the production-ready `prisma migrate` workflow:

1. ✅ **Generated baseline migration** (`0_init`) with complete schema DDL
2. ✅ **Container runs** `prisma migrate deploy` on startup
3. ❌ **Migration fails with P3018**: `type "RuleType" already exists`
4. ❌ **Container restart loop with P3009**: Prisma detects failed migration, refuses to proceed
5. ⚠️ **Required manual intervention**: SQL UPDATE to mark migration as applied

**Root Cause**: The database already had tables/types from `prisma db push`. The `0_init` migration tried to create objects that already existed.

### The Official Solution: Baselining with `migrate resolve`

From [Prisma's official baselining documentation](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining):

> "After generating the baseline SQL, use `npx prisma migrate resolve --applied` to mark the initial migration (`0_init`) as already applied in the `_prisma_migrations` table. This command prevents Prisma Migrate from attempting to re-apply it during `migrate deploy` operations, which is crucial for existing databases."

**Official Workflow for Existing Databases**:

```bash
# 1. Generate baseline migration (represents current database state)
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/0_init/migration.sql

# 2. Mark baseline as already applied (THIS IS THE KEY STEP)
npx prisma migrate resolve --applied 0_init

# 3. Future migrations work normally
npx prisma migrate deploy
```

## Official Prisma Approach

According to [Prisma's official documentation](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production):

- **Development**: Use `npx prisma migrate dev` to create and apply migrations
- **Production**: Use `npx prisma migrate deploy` to apply existing migrations
- **Existing Databases**: Use `npx prisma migrate resolve --applied <migration>` for baselining
- **Migration Files**: Commit the `prisma/migrations/` folder to version control

## Implementation

### Production Environment (Automatic Baselining)

**Files**:

- `apps/backend/Dockerfile` (entrypoint configuration)
- `apps/backend/docker-entrypoint.sh` (smart migration handler)

The production container uses an **intelligent entrypoint script** that automatically handles the baselining scenario:

```dockerfile
# Dockerfile excerpt
COPY --chown=nestjs:nestjs apps/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

**How it works** (`docker-entrypoint.sh`):

1. **First Migration Attempt**: Runs `npx prisma migrate deploy`
2. **If P3018 Error** (type/table already exists):
   - Automatically runs `npx prisma migrate resolve --applied 0_init`
   - Re-attempts `npx prisma migrate deploy`
   - Succeeds (no pending migrations after baseline resolution)

3. **If P3009 Error** (failed migration detected):
   - Automatically runs `npx prisma migrate resolve --applied 0_init`
   - Clears failed migration state
   - Re-attempts migration deployment

4. **If Success on First Attempt**: Proceeds normally (no baseline needed)

5. **Application Starts**: `exec node dist/main`

**Benefits**:

- ✅ **Zero manual intervention** for both existing and fresh databases
- ✅ **Automatic baselining** following official Prisma workflow
- ✅ **Production-safe** error handling with clear logging
- ✅ **Idempotent** — safe to restart container multiple times
- ✅ **Future migrations work normally** after baseline is resolved

### Development Environment

**File**: `apps/backend/Dockerfile` (development stage)

The development container Dockerfile includes migration commands:

```dockerfile
CMD ["sh", "-c", "cd /app/apps/backend && npx prisma migrate dev && pnpm dev"]
```

**Important**: In `docker-compose.development.yml`, the `command: pnpm dev` override skips automatic migrations. This is intentional for hot-reload development. Run migrations manually when needed:

```bash
# Method 1: One-time migration before starting
docker exec aria-dev-backend sh -c "cd /app/apps/backend && npx prisma migrate dev --name init"

# Method 2: Interactive shell for development
docker exec -it aria-dev-backend sh
cd /app/apps/backend
npx prisma migrate dev --name your_migration_name
```

**Why this approach?**

- Prevents container restarts on schema changes during development
- Allows developers to iterate on schema without rebuilding containers
- Supports interactive migration naming

## Migration Files Structure

```
apps/backend/prisma/
├── schema.prisma                    # Database schema definition
├── migrations/
│   ├── migration_lock.toml          # Provider lock file (PostgreSQL)
│   ├── 0_init/
│   │   └── migration.sql            # Initial baseline migration
│   └── YYYYMMDDHHMMSS_name/
│       └── migration.sql            # Subsequent migrations
└── seed.ts                          # (Optional) Database seeding script
```

### migration_lock.toml

This file locks the database provider to prevent accidental changes:

```toml
# Please do not edit this file manually
# It should be added in your version-control system (i.e. Git)
provider = "postgresql"
```

## Creating the Initial Migration

The initial migration (`0_init`) was created using Prisma's official baselining approach:

```bash
# 1. Create migration directory
mkdir -p apps/backend/prisma/migrations/0_init

# 2. Generate SQL from schema
docker exec aria-backend npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > apps/backend/prisma/migrations/0_init/migration.sql

# 3. Create migration lock file
echo '# Please do not edit this file manually
# It should be added in your version-control system (i.e. Git)
provider = "postgresql"' > apps/backend/prisma/migrations/migration_lock.toml
```

Since the database already had tables from a previous `prisma db push`, we marked the migration as applied:

```bash
# Update the _prisma_migrations table
docker exec aria-postgres psql -U aria -d aria -c \
  "UPDATE _prisma_migrations SET finished_at = NOW(), logs = NULL WHERE migration_name = '0_init';"
```

## Creating New Migrations

### During Development

```bash
# 1. Modify prisma/schema.prisma
# 2. Create and apply migration
cd apps/backend
npx prisma migrate dev --name descriptive_name
```

This will:

- Compare current schema to database
- Generate a migration SQL file
- Apply the migration to the database
- Update Prisma Client types

### For Production Deployment

```bash
# 1. Ensure migrations are committed to git
git add apps/backend/prisma/migrations/
git commit -m "feat: add new migration for X"

# 2. Rebuild and deploy
docker compose -f docker-compose.production.yml build backend
docker compose -f docker-compose.production.yml up -d backend
```

The migration runs automatically on container startup via `prisma migrate deploy`.

## Handling Migration Failures

If a migration fails in production:

### Option 1: Mark as Applied (if schema is correct)

```bash
docker exec aria-backend npx prisma migrate resolve --applied <migration_name>
```

### Option 2: Roll Back (mark as rolled back)

```bash
docker exec aria-backend npx prisma migrate resolve --rolled-back <migration_name>
```

### Option 3: Manual Fix

```bash
# Connect to database
docker exec -it aria-postgres psql -U aria -d aria

# Manually apply missing changes or fix issues
# Then mark migration as applied
```

## Best Practices

1. **Always commit migrations**: Migration files in `prisma/migrations/` should be in version control
2. **Test migrations locally**: Run `prisma migrate dev` before deploying to production
3. **Keep migrations backward-compatible**: Avoid breaking changes when possible
4. **Use descriptive names**: `npx prisma migrate dev --name add_user_roles`
5. **Never edit applied migrations**: Create a new migration instead
6. **Monitor migration logs**: Check `docker logs aria-backend` after deployment

## Prisma Binary Targets

The schema includes binary targets for Alpine Linux (used in Docker):

```prisma
generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

This ensures the Prisma Query Engine works correctly in Alpine-based Docker images.

## Troubleshooting

### "Migration failed to apply"

**Cause**: Migration SQL conflicts with existing database state

**Solution**:

1. Check `docker logs aria-backend` for specific error
2. Connect to database and inspect current schema
3. Either fix manually and mark as applied, or roll back

### "No pending migrations to apply"

**Cause**: All migrations are already applied (normal state)

**Solution**: No action needed - this is the expected output

### "Migration XX started at... failed"

**Cause**: Previous migration attempt was interrupted

**Solution**:

```bash
# Check migration status
docker exec aria-postgres psql -U aria -d aria -c "SELECT * FROM _prisma_migrations;"

# Mark as applied if schema is correct
docker exec aria-postgres psql -U aria -d aria -c \
  "UPDATE _prisma_migrations SET finished_at = NOW(), logs = NULL WHERE migration_name = 'XX';"
```

## References

- [Prisma Migrate Documentation](https://www.prisma.io/docs/orm/prisma-migrate)
- [Development and Production Workflows](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [Deploying to Docker](https://www.prisma.io/docs/guides/docker)
- [Baselining Existing Databases](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining)

---

**Last Updated**: October 24, 2025  
**Implements**: Agent 7 (Official Docs Enforcer) - Using official Prisma migration workflows
