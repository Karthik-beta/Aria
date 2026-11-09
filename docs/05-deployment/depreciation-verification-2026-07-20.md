# Depreciation Docker Verification — 2026-07-20/21

## Outcome

The depreciation workflow now passes isolated PostgreSQL/Redis verification. The
daily scheduler discovers due periods, BullMQ processes them, the barrier waits for
their database postings, and restart rediscovery re-links an existing journal without
creating a duplicate. No production or pre-existing development data was used.

## Corrections to the initial report

The initial PostgreSQL credential finding was a false positive: host ports `5432`
and `6379` were already occupied, so the shell checks reached another local service.
Fresh project-scoped Compose volumes were re-tested with ports `55432` and `56379`;
the configured `aria_dev` / `dev_password` credentials authenticated successfully.

## Changes made

- Prisma and Nest bootstrap configuration no longer overwrite an explicitly supplied
  `DATABASE_URL` with a local dotenv value. This keeps Compose and isolated test
  connections authoritative.
- The depreciation test runner now compiles only the requested specs, preserving
  Nest decorator metadata without allowing unrelated backend test type errors to
  block a focused run.
- The integration test waits for the fail-closed depreciation barrier, proving actual
  discovery and posting before application shutdown.
- QueueEvents readiness uses BullMQ's `waitUntilReady()` instead of sending a command
  through its blocking event-stream connection.

## Verification evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Development and production Compose rendering | Pass | Both `docker compose ... config --quiet` commands returned `0`. |
| Isolated PostgreSQL/Redis | Pass | Fresh Compose volumes became healthy; `aria_dev` authenticated over port `55432`; Redis was available on `56379`. |
| Prisma migration targeting | Pass | `DATABASE_URL=...:55432/aria_dev bun x --bun prisma migrate deploy` applied all 47 migrations to the intended isolated database. |
| Migration compatibility | Pass | `bun run test:depreciation:migrations` exercised fresh and legacy migration paths against the isolated PostgreSQL instance. |
| Demo depreciation data | Pass | Small demo load created 14 assets, 18 schedules, 619 schedule entries, 14 finance books, and initially zero depreciation journals. |
| Focused depreciation unit suite | Pass | `bun run test:depreciation:unit` passed 40 tests with real Redis available for the module-graph readiness test. |
| Runtime integration and posting | Pass | `bun run test:depreciation:integration` booted PostgreSQL, Redis, queue events, and the worker; the barrier completed live due-period posting. |
| Backend readiness | Pass | `/health/ready` returned `200` with PostgreSQL, Redis producer, worker, and QueueEvents all `up`. |
| Restart/idempotency recovery | Pass | After clearing the isolated Redis queue state and resetting one schedule link, startup discovery enqueued one period; the worker returned `already-posted`, restored the link, and journal count stayed at `13`. |

## Environment limitation

`docker compose build backend` could not complete in this workstation because the
Docker CLI was configured to invoke `docker-credential-desktop.exe`, which was not
available on the Linux path. This did not affect the verification: Compose supplied
the isolated PostgreSQL/Redis services and the local backend process used the same
Compose environment values. Resolve the Docker credential-helper configuration before
using the full backend image build on this workstation.

## Reproduction commands

```bash
# Run from the repository root. Use an isolated Compose override with free ports.
docker compose -p aria-depreciation-verification \
  -f docker-compose.development.yml \
  -f /tmp/aria-depreciation-compose-isolated.yml up -d postgres redis

cd apps/backend
DATABASE_URL=postgresql://aria_dev:dev_password@localhost:55432/aria_dev \
  bun x --bun prisma migrate deploy
DATABASE_URL=postgresql://aria_dev:dev_password@localhost:55432/aria_dev \
REDIS_URL=redis://localhost:56379 APP_TIME_ZONE=Asia/Kolkata \
  bun run test:depreciation:unit
DATABASE_URL=postgresql://aria_dev:dev_password@localhost:55432/aria_dev \
REDIS_URL=redis://localhost:56379 APP_TIME_ZONE=Asia/Kolkata \
  bun run test:depreciation:integration
```

## Cleanup

The isolated Compose project and its named volumes were removed after verification:

```bash
docker compose -p aria-depreciation-verification \
  -f docker-compose.development.yml \
  -f /tmp/aria-depreciation-compose-isolated.yml down --volumes --remove-orphans
```
