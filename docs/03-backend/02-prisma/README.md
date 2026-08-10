# Prisma & Database — Quick Reference

## Overview

Aria uses **Prisma 7** with the **PrismaPg** adapter for PostgreSQL. Key differences from earlier Prisma versions:

- Provider: `prisma-client` (not `prisma-client-js`)
- Required `output` field in generator block
- Module format: `cjs` (for NestJS compatibility)
- Datasource URL configured in `prisma.config.ts` (not in `schema.prisma`)

## Schema Location

```
apps/backend/prisma/
├── schema.prisma              # Database schema definition
├── prisma.config.ts           # Datasource configuration
├── migrations/                # Migration files
├── seed-authorization.ts      # (removed — better-auth admin plugin handles roles)
├── seeds/                     # Additional seed scripts
└── demo-data/                 # Demo data CLI + orchestrator + README
```

## Production Deployment

Migrations run **automatically** on container startup via `docker-entrypoint.sh`.

```bash
# 1. Commit your migration files
git add apps/backend/prisma/migrations/
git commit -m "feat: add new migration"

# 2. Deploy
docker compose -f docker-compose.production.yml up -d --build backend

# 3. Verify (migrations apply automatically)
docker logs aria-backend | grep "migrate"
```

## Development — Creating New Migrations

### Recommended: Local with Bun

```bash
cd apps/backend

# 1. Modify schema.prisma
# 2. Create and apply migration
bun x --bun prisma migrate dev --name your_feature_name
```

### Inside Container

```bash
docker exec -it aria-dev-backend sh -c "cd /app/apps/backend && bun x --bun prisma migrate dev --name your_feature_name"
```

## Common Commands

```bash
cd apps/backend

# View migration status
bun x --bun prisma migrate status

# Generate Prisma Client (after schema changes)
bun x --bun prisma generate

# Reset database (WARNING: deletes all data)
bun x --bun prisma migrate reset

# Apply migrations without creating new ones (production)
bun run db:migrate:deploy

# Open Prisma Studio (visual database browser)
bun x --bun prisma studio

# Seed authorization data
# (Removed — better-auth admin plugin handles role seeding on startup)

# Load inventory demo data
ARIA_ALLOW_DEMO_DATA_MUTATION=true ARIA_DEMO_DATABASE_ISOLATED=true \
  bun prisma/demo-data/cli.ts load --scale=medium
```

For the full demo-data guide, see
[apps/backend/prisma/demo-data/README.md](../../../apps/backend/prisma/demo-data/README.md).

## Schema Configuration (Prisma v7)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
  moduleFormat = "cjs"
}

datasource db {
  provider = "postgresql"
  // URL is configured in prisma.config.ts, not here
}
```

The datasource URL is resolved in `prisma.config.ts`, which reads from `DATABASE_URL` environment variable.

## Troubleshooting

### Migration Failed on Startup

```bash
# 1. Check logs
docker logs aria-backend --tail 50

# 2. Connect to database and inspect
docker exec -it aria-postgres psql -U aria -d aria

# 3. Mark migration as applied (if schema is correct)
docker exec aria-backend bun x --bun prisma migrate resolve --applied <migration_name>

# 4. Restart container
docker compose -f docker-compose.production.yml restart backend
```

### Need to Reset Development Database

```bash
cd apps/backend
# WARNING: Deletes all data!
bun x --bun prisma migrate reset
```

## When to Create Migrations

**DO create migrations for:**

- Adding/removing tables
- Adding/removing columns
- Changing column types
- Adding/removing indexes
- Adding/removing constraints

**DON'T need migrations for:**

- Changing TypeScript types only
- Adding comments to schema
- Renaming Prisma Client properties (use `@map()`)

## Best Practices

1. **Always commit migration files** to version control
2. **Test locally** before deploying to production
3. **Use descriptive names**: `add_user_roles` not `migration_1`
4. **One logical change per migration** (makes rollback easier)
5. **Review generated SQL** before committing

---

**Official Docs**: https://www.prisma.io/docs/orm/prisma-migrate
