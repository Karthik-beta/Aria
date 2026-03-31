# Backend Documentation

Overview of the Aria ERP backend, built with NestJS 11, tRPC, Prisma 7, and better-auth.

## Overview

The backend is a monolithic NestJS application responsible for:

- Business logic and domain services
- tRPC API endpoints for the frontend
- Database access via Prisma 7 (PrismaPg adapter)
- Authentication via better-auth (session-based)
- RBAC/ABAC authorization

## Tech Stack

| Concern | Technology |
|---------|-----------|
| Framework | NestJS 11 |
| Language | TypeScript (strict mode) |
| API | tRPC (type-safe RPC) |
| ORM | Prisma 7 (PrismaPg adapter) |
| Database | PostgreSQL |
| Authentication | better-auth (email+password, username) |
| Authorization | Custom RBAC + ABAC |
| Testing | Jest |
| Linting | Biome |

## Project Structure

```
apps/backend/
├── src/
│   ├── apps/                  # Feature modules
│   │   └── inventory/         # Inventory management module
│   │       ├── services/      # Domain services (batch, delivery, warehouse, etc.)
│   │       ├── trpc/          # Inventory tRPC router
│   │       ├── reports/       # Report services (item, stock, transaction)
│   │       ├── __tests__/     # Unit tests
│   │       ├── inventory.module.ts
│   │       ├── inventory.service.ts  # Facade delegating to sub-services
│   │       └── inventory.types.ts
│   ├── auth/                  # better-auth integration
│   │   ├── auth.config.ts     # Auth configuration (plugins, session, cookies)
│   │   ├── auth.module.ts     # Global auth module
│   │   └── auth.service.ts    # Default admin user creation on startup
│   ├── authorization/         # Permission / policy system
│   │   ├── policy.service.ts  # User policy resolution and caching
│   │   ├── role.service.ts    # Role CRUD
│   │   ├── permission.service.ts # Permission CRUD + wildcard matching
│   │   ├── scope.service.ts   # App / team / hierarchy scoping
│   │   └── audit.service.ts   # Audit logging
│   ├── trpc/                  # tRPC assembly layer
│   │   ├── app-router.ts      # Top-level router (inventory + admin + auth + account)
│   │   ├── trpc.ts            # tRPC init, middleware, protected/public procedures
│   │   ├── trpc.context.ts    # Request context (Prisma + req/res)
│   │   ├── trpc.service.ts    # NestJS service wiring DI → tRPC
│   │   ├── trpc.module.ts     # NestJS module
│   │   └── routers/           # Admin, authorization, account routers
│   ├── shared/                # Shared services (PrismaService, etc.)
│   └── generated/             # Prisma-generated client (gitignored)
│       └── prisma/
├── prisma/
│   ├── schema.prisma          # Database schema (Prisma v7)
│   ├── prisma.config.ts       # Prisma config (datasource URL resolution)
│   ├── migrations/            # Database migrations
│   ├── seed-authorization.ts  # Seeds roles, permissions, default apps
│   ├── seeds/                 # Additional seed scripts
│   └── demo-data/             # Demo data system (CLI + orchestrator)
└── test/                      # Integration tests
```

## Feature Modules

Feature modules live in `src/apps/<domain>`. Currently implemented:

### Inventory Module (`src/apps/inventory/`)

The inventory module follows a **service-per-domain** pattern:

| Service | Responsibility |
|---------|---------------|
| `item-catalog.service.ts` | Items, item groups, brands, attributes |
| `warehouse.service.ts` | Warehouses and bin locations |
| `uom.service.ts` | Units of measure + conversion factors |
| `batch.service.ts` | Batch tracking |
| `serial-no.service.ts` | Serial number tracking |
| `stock-transaction.service.ts` | Stock entries, reconciliation, ledger |
| `purchase-receipt.service.ts` | Purchase receipts |
| `delivery.service.ts` | Delivery notes |
| `installation-note.service.ts` | Installation notes |
| `settings.service.ts` | Inventory settings + stock settings |
| `report.service.ts` | Inventory reports (item, stock, transaction) |
| `quality-inspection.service.ts` | Quality inspections |

The `InventoryService` acts as a facade, delegating to sub-services. The `inventory.router.ts` file exposes all procedures through a single tRPC router.

## API

The backend exposes a **tRPC** API — not REST. tRPC provides end-to-end type safety between frontend and backend without code generation.

See [tRPC API Documentation](./01-api/README.md) for details on routers and procedures.

## Authentication

Authentication uses **better-auth** with:

- Email + password authentication
- Username plugin (3–20 characters)
- Custom session enrichment (`mustChangePassword`, `passwordChangedAt`)
- Secure cookies in production
- `BETTER_AUTH_SECRET` required in production (ephemeral key in dev)
- Default admin user created on startup via env vars

See [Authentication Documentation](../02-architecture/01-authentication/README.md).

## Authorization

Custom RBAC + ABAC system with:

- **Roles**: super_admin, admin, manager, user, viewer (+ custom roles)
- **Permissions**: System, app, and entity-level scopes with wildcard matching
- **Policy caching**: 60-second TTL
- **Audit logging**: All authorization changes are logged

See [Authorization Documentation](../02-architecture/02-authorization/README.md).

## Database

The backend uses **Prisma 7** with the **PrismaPg** adapter for PostgreSQL.

See [Prisma Documentation](./02-prisma/README.md) for schema management and migrations.

### Key Prisma v7 Changes

- Provider: `prisma-client` (not `prisma-client-js`)
- Required `output` field in generator
- Module format: `cjs` (for NestJS compatibility)
- Datasource URL configured in `prisma.config.ts` (not in schema)

## Demo Data

The demo data system in `prisma/demo-data/` provides realistic test data for the Inventory module:

```bash
cd apps/backend

# Seed demo data (small/medium/large scale)
bun x tsx prisma/demo-data/cli.ts seed --scale medium

# Check demo data status
bun x tsx prisma/demo-data/cli.ts status

# Clean demo data
bun x tsx prisma/demo-data/cli.ts clean
```

Business context: **Pivotr Electronics Pvt Ltd** — a Bangalore-based SME manufacturing electronic components.

## Testing

Tests use Jest with NestJS testing utilities:

```bash
# Run all backend tests
bun --filter backend test

# Run specific test file
bun --filter backend test -- inventory-test-file.spec.ts

# Run with coverage
bun --filter backend test -- --coverage
```

Tests are co-located with source in `__tests__/` directories, using `.spec.ts` suffix.

## Production Build

```bash
bun --filter backend build
```

This creates a `dist` directory with compiled JavaScript.
