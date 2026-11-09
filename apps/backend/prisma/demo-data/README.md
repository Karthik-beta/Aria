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

The entrypoint is [`cli.ts`](./cli.ts), which orchestrates the full seeding
flow through [`seed-master.ts`](./seed-master.ts),
[`seed-transactions.ts`](./seed-transactions.ts), and
[`cleanup.ts`](./cleanup.ts).

## How to run it

Run these commands from `apps/backend`:

```bash
# Standard one-time small demo load used for deployments
bun run demo:load:small

# Load demo data and post every depreciation period due today
REDIS_URL=redis://localhost:6379 APP_TIME_ZONE=Asia/Kolkata \
  bun prisma/demo-data/cli.ts load --scale=medium

# Reproduce a fixed accounting snapshot
REDIS_URL=redis://localhost:6379 APP_TIME_ZONE=Asia/Kolkata \
  bun prisma/demo-data/cli.ts load --scale=small --as-of=2026-07-22

# Inspect how much demo data is present
bun prisma/demo-data/cli.ts status

# Remove the demo dataset for the configured company
bun prisma/demo-data/cli.ts clean
```

Supported scale values:

- `small`
- `medium` (default)
- `large`

`load` requires PostgreSQL, Redis, and an IANA `APP_TIME_ZONE`. It starts the
same BullMQ worker used by the backend, without starting another cron
scheduler, and waits for every due depreciation entry to be posted before it
reports success. Monthly, quarterly, half-yearly, and yearly schedules are
represented; the daily scheduler discovers due work and daily pro-rata affects
amounts, while future schedule rows remain unposted projections.

Stop the backend before replacing the demo dataset so its scheduler cannot
discover records while cleanup and loading are in progress. A failed load exits
non-zero. Correct the dependency or posting error and rerun `load`; the loader
cleans the incomplete Pivotr dataset before rebuilding it.

Container startup never loads demo data. For Compose, run the one-time command
from the backend image after PostgreSQL, Redis, and migrations are ready:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml run --rm backend bun run demo:load:small
```

For Railway, wait for `/health/ready` to return `200`, then run:

```bash
railway ssh --service <exact-backend-service-name> -- bun --cwd=/app/apps/backend run demo:load:small
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
- sample records for QA or screenshots
- a reproducible training dataset

Prefer running it on a fresh database, or run `clean` before loading again.
The loader is not meant to be a general-purpose import tool.

## Related seed scripts

This demo loader is separate from Prisma's built-in seed hook. In this repo,
`prisma db seed` runs [`seed-authorization.ts`](../seed-authorization.ts),
which seeds roles, permissions, and default apps.

## Troubleshooting

- Make sure `DATABASE_URL` is set before running the CLI.
- `load` also requires `REDIS_URL` and `APP_TIME_ZONE`; `clean` and `status`
  remain database-only commands.
- If you see older docs mentioning `seed`, use `load` instead.
- If the database already contains demo records, run `clean` first.
