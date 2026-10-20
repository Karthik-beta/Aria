# Changelog

All notable changes to Aria ERP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Monorepo setup with Bun + Turborepo
- NestJS 11 backend with tRPC and Prisma 7
- Next.js frontend with App Router and route groups (Asset, CRM, HRMS, Inventory)
- Shared packages: `@aria/types`, `@aria/utils`, `@aria/api-contract`, `@aria/tsconfig`
- Biome for linting and formatting
- Docker Compose deployment with Caddy v2 reverse proxy
- CI pipeline via GitHub Actions
- Authentication via better-auth
- Flat role model via better-auth admin plugin
- Playwright E2E and Vitest unit test infrastructure
- Prometheus + Grafana monitoring configuration
- Inventory dashboard overview at `/inventory/dashboard/overview` with KPI cards, charts, and live snapshot data
- Backend `trpc.inventory.getDashboardData` endpoint for stock KPIs, warehouse stock distribution, low-stock alerts, batch expiry insights, and delivery status
- Frontend dashboard utilities and insight helpers in `apps/frontend/src/app/inventory/dashboard/overview/dashboard.utils.ts` plus unit tests
- E2E coverage for inventory dashboard route and rendering: `apps/frontend/e2e/inventory-dashboard.spec.ts`
- Asset custodian is now a link to an `Employee` master (ERPNext parity): searchable employee dropdown on the asset form, `trpc.asset.listEmployees` lookup, demo employees, and "Asset issued to / returned from Employee" entries in the Asset Activity report when the custodian is set or changed

### Fixed

- E2E suite runs against the real backend again: Playwright starts the API with a seeded super admin, signs in once through better-auth and reuses that session, and stale specs left over from the removed dev auth bypass were updated
- Sign-up page "View dashboard" link pointed at the non-existent `/dashboard/overview`; it now opens the inventory dashboard
