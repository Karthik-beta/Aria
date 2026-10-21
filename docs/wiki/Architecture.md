# Architecture

Aria is a Bun + Turborepo monorepo.

```
apps/
├── backend/        NestJS 11 API: tRPC 11, Prisma 7, PostgreSQL, BullMQ on Redis
│   ├── prisma/     schema.prisma (one schema for all modules), migrations, demo data
│   └── src/
│       ├── apps/   feature services: asset, inventory, company
│       ├── trpc/   app router and routers (inventory, asset, company, account)
│       └── common/ guards, pipes, interceptors, decorators
└── frontend/       Next.js 16 App Router, React 19, Tailwind 4, TanStack Query
    └── src/app/    route groups: asset, inventory, admin, crm, hrms, onboarding, auth
packages/
├── types/              @aria/types: shared types and Zod 4 schemas (single source of truth)
├── utils/              @aria/utils: pure helpers
├── api-contract/       tRPC contract layer
├── report-export/      report export helpers
└── config-typescript/  shared tsconfig presets
```

## Key decisions

- **End-to-end types.** The frontend calls the backend through tRPC. Request and response shapes come from Zod schemas in `@aria/types`, so a schema change breaks the build on both sides instead of failing at runtime.
- **Thin routers, fat services.** tRPC routers validate and delegate; business rules live in services under `src/apps/<domain>/`. This is where ERPNext DocType controller logic is ported to (see [ERPNext Porting](ERPNext-Porting)).
- **Authentication and tenancy** use Better Auth with the username, admin, organization and custom-session plugins. Each company belongs to an organization.
- **Background work** such as asset depreciation runs on a BullMQ queue, so posting schedules survive restarts.
- **Tooling:** Biome for formatting and linting, Vitest and Playwright for tests, Turborepo for task caching.

More: [architecture](https://github.com/Karthik-beta/Aria/blob/master/docs/02-architecture/README.md), [authentication](https://github.com/Karthik-beta/Aria/blob/master/docs/02-architecture/01-authentication/README.md), [authorization](https://github.com/Karthik-beta/Aria/blob/master/docs/02-architecture/02-authorization/README.md), [tRPC API](https://github.com/Karthik-beta/Aria/blob/master/docs/03-backend/01-api/README.md), [Prisma](https://github.com/Karthik-beta/Aria/blob/master/docs/03-backend/02-prisma/README.md), [frontend](https://github.com/Karthik-beta/Aria/blob/master/docs/04-frontend/README.md).
