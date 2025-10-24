# Prisma Migrations - Quick Reference

## TL;DR

Database migrations now run **automatically** on container startup. No manual intervention needed.

## Production Deployment

```bash
# 1. Commit your migration files
git add apps/backend/prisma/migrations/
git commit -m "feat: add new migration"

# 2. Deploy
docker compose -f docker-compose.production.yml up -d --build backend

# 3. Verify (migrations apply automatically)
docker logs aria-backend | grep "migrate"
```

## Development - Creating New Migrations

### Method 1: Inside Container (Recommended)

```bash
# 1. Modify schema.prisma
# 2. Create migration
docker exec -it aria-dev-backend sh -c "cd /app/apps/backend && npx prisma migrate dev --name your_feature_name"
```

### Method 2: Local (Requires local DB)

```bash
cd apps/backend
npx prisma migrate dev --name your_feature_name
```

## Common Commands

```bash
# View migration status
docker exec aria-backend npx prisma migrate status

# View migrations history (database)
docker exec aria-postgres psql -U aria -d aria -c "SELECT * FROM _prisma_migrations;"

# Generate Prisma Client (after schema changes)
docker exec aria-backend npx prisma generate
```

## Troubleshooting

### Migration Failed on Startup

```bash
# 1. Check logs
docker logs aria-backend --tail 50

# 2. Connect to database and inspect
docker exec -it aria-postgres psql -U aria -d aria

# 3. Mark migration as applied (if schema is correct)
docker exec aria-backend npx prisma migrate resolve --applied <migration_name>

# 4. Restart container
docker compose -f docker-compose.production.yml restart backend
```

### Need to Reset Development Database

```bash
# WARNING: Deletes all data!
docker exec aria-dev-backend sh -c "cd /app/apps/backend && npx prisma migrate reset"
```

## File Structure

```
apps/backend/prisma/
├── schema.prisma              # Your schema definition
├── migrations/
│   ├── migration_lock.toml    # Provider lock (don't edit)
│   ├── 0_init/
│   │   └── migration.sql      # Baseline migration
│   └── 20251024_add_feature/
│       └── migration.sql      # Your new migration
```

## When to Create Migrations

✅ **DO create migrations for**:
- Adding/removing tables
- Adding/removing columns
- Changing column types
- Adding/removing indexes
- Adding/removing constraints

❌ **DON'T need migrations for**:
- Changing TypeScript types only
- Adding JSDoc comments
- Renaming Prisma Client properties (use `@map()`)

## Best Practices

1. **Always commit migration files** to version control
2. **Test locally** before deploying to production
3. **Use descriptive names**: `add_user_roles` not `migration_1`
4. **One logical change per migration** (makes rollback easier)
5. **Review generated SQL** before committing

## Documentation

Full guide: [`apps/backend/PRISMA_MIGRATIONS.md`](../apps/backend/PRISMA_MIGRATIONS.md)

---

**Official Docs**: https://www.prisma.io/docs/orm/prisma-migrate
