# Depreciation Production Runbook

This runbook covers the single-replica production release in which the NestJS
API, scheduler, and BullMQ worker share one backend container. Do not scale the
backend above one replica until API, scheduler, and worker roles are separated.

## Required configuration

Production Compose refuses to render without `POSTGRES_PASSWORD`,
`REDIS_PASSWORD`, `APP_TIME_ZONE`, and `BETTER_AUTH_SECRET`. `APP_TIME_ZONE`
must be a valid IANA timezone. The three initial-administrator values are needed
only when bootstrapping the first account.

`REDIS_URL` may contain managed-service credentials. If it has no password,
the backend uses `REDIS_PASSWORD`. Startup fails when both contain different
passwords.

## Pre-deployment checks

1. Take a PostgreSQL backup and complete a restore rehearsal.
2. Verify the `redis-data` volume exists and Redis AOF is enabled.
3. Build immutable backend and frontend image tags.
4. Start PostgreSQL and Redis, then run:

   ```bash
   docker compose -f docker-compose.production.yml run --rm backend \
     bun --cwd=/app/apps/backend run depreciation:preflight
   docker compose -f docker-compose.production.yml run --rm backend \
     bun --cwd=/app/apps/backend run depreciation:queue -- pause
   ```

Archive the preflight JSON. Missing company/category accounts, invalid active
schedules, or duplicate active schedules are blockers.

## Deployment

```bash
docker compose -f docker-compose.production.yml run --rm migrate
docker compose -f docker-compose.production.yml up -d backend frontend caddy
curl --fail https://YOUR_DOMAIN/health/ready
docker compose -f docker-compose.production.yml exec backend \
  bun --cwd=/app/apps/backend run depreciation:queue -- resume
```

Observe readiness, discovery failures, terminal failures, and oldest-unposted
lag for at least one reconciliation interval (15 minutes by default).

## Existing untracked database baseline

Baselining is operator-only. Never put `migrate resolve` in an entrypoint or
deployment retry loop.

1. Stop application writes and take a verified backup.
2. Compare the live schema with `prisma/migrations/0_init/migration.sql`.
3. Resolve discrepancies before recording migration history.
4. Mark the baseline exactly once:

   ```bash
   cd apps/backend
   bun x --bun prisma migrate resolve --applied 0_init
   bun x --bun prisma migrate status
   bun run db:migrate:deploy
   ```

If any step fails, stop and diagnose it. Do not resolve a named failed
migration merely to make deployment continue.

## Queue operations

```bash
bun --cwd apps/backend run depreciation:queue -- status
bun --cwd apps/backend run depreciation:queue -- pause
bun --cwd apps/backend run depreciation:queue -- resume
```

Pausing prevents new jobs from starting; it does not cancel an active database
transaction. Terminal accounting failures require correcting the underlying
company/account/freeze configuration and an explicit operator decision. Never
delete posted journals or database posting links to force a retry.

## Recovery test

With due work remaining, stop the backend and confirm `/health/ready` fails.
Restart it and verify startup or reconciliation rediscovers pending periods.
Confirm that each schedule entry has at most one posting and each posted journal
has balanced debit and credit totals. Repeat by restarting Redis and verify
readiness transitions from 503 back to 200 before resuming the queue.

## Rollback

1. Pause the queue.
2. Restore the previous application image.
3. Keep additive depreciation schema changes in place.
4. If a migration failed, restore the rehearsed backup when required.
5. Do not delete or rewrite posted depreciation journals. Accounting
   corrections require an explicit reversal workflow.

## Official guidance

- [NestJS Terminus health checks](https://docs.nestjs.com/recipes/terminus)
- [NestJS BullMQ queues](https://docs.nestjs.com/techniques/queues)
- [BullMQ connections](https://docs.bullmq.io/guide/connections)
- [BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production)
- [Prisma production migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command)
- [Railway private networking](https://docs.railway.com/networking/private-networking)
- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
