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
# Load demo data
bun prisma/demo-data/cli.ts load --scale=medium

# Inspect how much demo data is present
bun prisma/demo-data/cli.ts status

# Remove the demo dataset for the configured company
bun prisma/demo-data/cli.ts clean
```

Supported scale values:

- `small`
- `medium` (default)
- `large`

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
- If you see older docs mentioning `seed`, use `load` instead.
- If the database already contains demo records, run `clean` first.
