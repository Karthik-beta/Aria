# Demo Data Loader

This folder contains the inventory and asset demo-data system used to populate
a full sample database for demos, QA, and training.

## What it does

The loader creates a coherent Pivotr Technologies business story:

- master data: brands, item groups, items, inventory items, warehouses,
    quality-inspection templates, shipping rules, inventory settings, asset
    locations, asset categories, maintenance teams, and fixed assets
- transactional data: purchase orders, purchase receipts, stock entries,
  sales orders, material requests, delivery notes, batches, serial numbers,
    pick lists, packing slips, delivery trips, installation notes,
    subcontracting orders, asset activities, asset maintenance logs, asset
    value adjustments, revaluation entries, and depreciation schedules
- asset lifecycle documents: submitted and draft (pending-submission)
  movements, pending and completed repairs, draft and submitted
  capitalizations, posted and cancelled disposals, balanced Asset-subledger
  entries, linked material issues, and qualified/booked CWIP examples

The entrypoint is [`cli.ts`](./cli.ts), which orchestrates the full seeding
flow through [`seed-master.ts`](./seed-master.ts),
[`seed-transactions.ts`](./seed-transactions.ts), and
[`cleanup.ts`](./cleanup.ts).

## How to run it

Run these commands from `apps/backend`:

```bash
# Standard one-time small demo load used for deployments. Both confirmations
# are required because `load` first removes the previous demo dataset.
ARIA_ALLOW_DEMO_DATA_MUTATION=true ARIA_DEMO_DATABASE_ISOLATED=true \
  bun run demo:load:small

# Load demo data and post every depreciation period due today
REDIS_URL=redis://localhost:6379 APP_TIME_ZONE=Asia/Kolkata \
ARIA_ALLOW_DEMO_DATA_MUTATION=true ARIA_DEMO_DATABASE_ISOLATED=true \
  bun prisma/demo-data/cli.ts load --scale=medium

# Reproduce a fixed accounting snapshot
REDIS_URL=redis://localhost:6379 APP_TIME_ZONE=Asia/Kolkata \
ARIA_ALLOW_DEMO_DATA_MUTATION=true ARIA_DEMO_DATABASE_ISOLATED=true \
  bun prisma/demo-data/cli.ts load --scale=small --as-of=2026-07-22

# Inspect how much demo data is present
bun prisma/demo-data/cli.ts status

# Remove the demo dataset for the configured company
ARIA_ALLOW_DEMO_DATA_MUTATION=true ARIA_DEMO_DATABASE_ISOLATED=true \
  bun prisma/demo-data/cli.ts clean

The two safety variables are intentionally required for both `load` and
`clean`. Set them only when `DATABASE_URL` points at a disposable database
created for the demo. The CLI also accepts `--allow-destructive --isolated-db`
for one-off invocations. `status` is read-only and does not require either
confirmation.

Before loading, verify the target has no pending migrations:

```bash
bun run db:verify-migrations
```

For migration smoke coverage, run `bun run test:depreciation:migrations` from
`apps/backend`. It creates disposable fresh and legacy databases, applies the
full migration chain, checks lifecycle tables/enums and finance-book/value-
adjustment backfills, and removes both databases on exit. The script never
uses the demo loader.
```

Supported scale values:

- `small`
- `medium` (default)
- `large`

`load` requires PostgreSQL, Redis, and an IANA `APP_TIME_ZONE`. It starts the
same depreciation BullMQ worker used by the backend, without starting another
cron scheduler, and waits for every due depreciation entry to be posted before
it reports success. Monthly, quarterly, half-yearly, and yearly schedules are
represented; the daily scheduler discovers due work and daily pro-rata affects
amounts, while future schedule rows remain unposted projections.

Lifecycle records are seeded only after due depreciation is posted. The loader
does not invoke lifecycle queues and does not fabricate purchase invoices. One
CWIP asset is already booked with balanced fixed-asset/CWIP lines; a second
qualified asset is intentionally left unbooked as a deterministic fixture. The
loader does not invoke CWIP discovery or the BullMQ capitalization worker; run
the dedicated discovery/worker command separately when demonstrating that
queue-backed flow and its idempotent posting behavior.

Stop the backend before replacing the demo dataset so its scheduler cannot
discover records while cleanup and loading are in progress. A failed load exits
non-zero. Correct the dependency or posting error and rerun `load`; the loader
cleans only deterministic demo-owned records before rebuilding them.

Container startup never loads demo data. For Compose, use a disposable demo
database and run the one-time command from the backend image after PostgreSQL,
Redis, and migrations are ready:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml run --rm \
  -e ARIA_ALLOW_DEMO_DATA_MUTATION=true -e ARIA_DEMO_DATABASE_ISOLATED=true \
  backend bun run demo:load:small
```

For Railway, wait for `/health/ready` to return `200`, then run:

```bash
railway ssh --service <exact-backend-service-name> -- \
  env ARIA_ALLOW_DEMO_DATA_MUTATION=true ARIA_DEMO_DATABASE_ISOLATED=true \
  bun --cwd=/app/apps/backend run demo:load:small
```

## Configuration

The default demo story lives in [`config.ts`](./config.ts).

- `company` defaults to `Pivotr Technologies Pvt Ltd`
- `currency` defaults to `INR`
- `dateRange` covers the last six months by default
- `modules` controls which sections of the story are included

If you need a different demo scenario, update `config.ts` or wrap the CLI in a
small script that calls `resolveConfig()` with overrides.

## When to use it

Use the demo loader when you need:

- realistic inventory data for a walkthrough
- realistic asset-management data for a walkthrough
- movement, repair, capitalization, disposal, Asset-subledger, and CWIP
  workflow walkthroughs
- sample records for QA or screenshots
- a reproducible training dataset

Prefer running it on a fresh isolated database. The loader is not a general-
purpose import tool and refuses to mutate a database unless the explicit
safety confirmations above are present.

## Related seed scripts

This demo loader is separate from Prisma's built-in seed hook. In this repo,
`prisma db seed` runs [`seed-authorization.ts`](../seed-authorization.ts),
which seeds roles, permissions, and default apps.

## Troubleshooting

- Make sure `DATABASE_URL` is set before running the CLI.
- `load` also requires `REDIS_URL` and `APP_TIME_ZONE`; `clean` and `status`
  remain database-only commands.
- If you see older docs mentioning `seed`, use `load` instead.
- If the database already contains demo records, rerun `load` with both safety
  confirmations; it cleans deterministic demo-owned records before loading.
- If the CLI reports `DEMO_DATA_SAFETY_GUARD`, verify that the database is
  disposable and set both `ARIA_ALLOW_DEMO_DATA_MUTATION=true` and
  `ARIA_DEMO_DATABASE_ISOLATED=true` (or pass both one-off flags).
