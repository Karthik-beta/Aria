# Backend Service

NestJS 11 application that powers the Aria ERP APIs. It follows the four-agent charter to stay simple, type-safe, automated, and well-tested.

## Daily Runbook

| Task             | Command                                   | Notes                                                  |
| ---------------- | ----------------------------------------- | ------------------------------------------------------ |
| Install deps     | `pnpm install` (run at repo root)         | Keep lockfile committed.                               |
| Start dev server | `pnpm --filter backend start:dev`         | Hot-reload with Nest CLI watcher.                      |
| Lint             | `pnpm --filter backend lint`              | Uses `@aria/eslint-config`; includes fixable rules.    |
| Type-check       | `pnpm --filter backend exec tsc --noEmit` | Extends `@aria/tsconfig/nest.json`.                    |
| Build            | `pnpm --filter backend build`             | Emits to `dist/`; driven by Nest CLI.                  |
| Unit tests       | `pnpm --filter backend test`              | Jest runner; co-locate specs under `src/**/*.spec.ts`. |
| E2E tests        | `pnpm --filter backend test:e2e`          | Use dedicated test module + SuperTest.                 |
| Coverage         | `pnpm --filter backend test:cov`          | Maintain ≥90% coverage for core modules.               |

## Agent Alignment

### Simplicity Advocate

- Generate modules, controllers, and services via `pnpx nest g` to preserve the Nest module graph.
- Organize domain logic under `src/modules/<domain>`; reserve `src/common` for cross-cutting concerns.
- Keep configuration centralized (`src/config`) and load via `ConfigModule` to avoid bespoke env handling.

### Type Safety Guardian

- Export DTOs, contracts, and enums from `@aria/types` and reuse them in controllers/services.
- Use `@nestjs/mapped-types` or `zod` wrappers to ensure runtime validation aligns with TypeScript signatures.
- Ensure Prisma (when integrated) generates types that flow back into `@aria/types` instead of duplicating shapes.

### Automation Steward

- Update `turbo.json` outputs if new build artifacts (OpenAPI specs, Prisma client) are generated.
- Reflect any new scripts (seeders, migrations) in CI workflows and document them below.
- Keep Docker Compose service definitions in sync with Nest entrypoints (`apps/backend` context).

### Quality Sentinel

- Co-locate unit tests with services to cover business logic paths.
- Write integration specs under `apps/backend/test` exercising HTTP endpoints via SuperTest.
- Capture metrics/logging with consistent structure so observability can evolve.
- Maintain a runbook for breaking schema migrations prior to release.

## Testing & Automation Checklist

- [ ] Introduce contract tests that compare serialized DTOs with shared types.
- [ ] Add smoke E2E tests covering authentication and core domain workflows once modules are available.
- [ ] Automate database migrations with `pnpm --filter backend exec prisma migrate deploy` (pending Prisma setup).
- [ ] Generate and publish OpenAPI spec snapshots for frontend consumption when modules stabilize.

## Module Layout

- `src/main.ts` — Nest bootstrap entry point.
- `src/app.module.ts` — root module; import feature modules here.
- `src/modules/**` — domain modules (asset, CRM, HR, inventory, auth).
- `src/common/**` — shared pipes, guards, interceptors.
- `test/**` — e2e specs executed via Jest.

Keep this README updated as modules ship. PRs should call out any deviations from agent expectations with remediation tasks.
