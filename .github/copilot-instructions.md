# Aria ERP Copilot Instructions

> AI coding guidance for the Aria B2B ERP monorepo—a pnpm + Turborepo workspace hosting NestJS backend and four Next.js 15 frontends.

## Architecture Overview

**Monorepo Structure**: Single repository with multiple applications under unified dependency management.
- Backend: `apps/backend` — NestJS 11 API service
- Frontends: `apps/frontend/{asset,CRM,hrms,inventory}` — Next.js 15 App Router applications
- Shared packages: `packages/{config-eslint,config-typescript,types,utils}`

**Four-Agent Philosophy** (see `AGENTS.md`):
1. **Simplicity Advocate**: Use framework generators, avoid custom configs, reuse shared packages
2. **Type Safety Guardian**: Import from `@aria/types`, extend `@aria/tsconfig`, maintain strict TypeScript
3. **Automation Steward**: Expose scripts via package.json, leverage Turborepo caching, mirror CI
4. **Quality Sentinel**: Ship tests with features, maintain coverage, enforce accessibility

## Critical Workflows

### Development Commands
```bash
# Root installation (run once after clone)
pnpm install

# Start individual apps
pnpm --filter backend dev        # NestJS on port 3000
pnpm --filter asset dev          # Next.js asset management
pnpm --filter crm dev            # Next.js CRM
pnpm --filter hrms dev           # Next.js HR
pnpm --filter inventory dev      # Next.js inventory

# Quality gates (must pass before PR)
pnpm format                      # Run Prettier across workspace
pnpm lint                        # ESLint with Prettier integration
pnpm test                        # All test suites
pnpm build                       # Production builds for all apps
```

### Scaffolding New Code
**Always use framework CLIs to generate code**:
```bash
# Backend (NestJS)
cd apps/backend
pnpm nest g module users         # Generate module
pnpm nest g controller users     # Generate controller
pnpm nest g service users        # Generate service

# Frontend (Next.js)
cd apps/frontend/asset
pnpx next                        # Follow Next.js conventions
```

**Never manually create** files that can be generated. Nest modules live in `apps/backend/src/modules/<domain>`.

## Type System & Shared Packages

### @aria/types — Single Source of Truth
All cross-app contracts originate here. Example structure:
```typescript
// packages/types/src/index.ts
export interface ApiResponse<T> {
  data: T;
  pagination?: Pagination;
}
```

**When adding types**:
1. Update `packages/types/src/index.ts`
2. Run `pnpm --filter @aria/types build`
3. Import via `@aria/types` in consuming apps

### @aria/utils — Pure Functions Only
Shared utilities must be **deterministic and side-effect free**:
```typescript
// packages/utils/src/index.ts
import type { Pagination } from '@aria/types';

export const paginate = (items: unknown[], { page, pageSize }: Pagination) => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};
```

**Anti-pattern**: Do NOT put I/O, network calls, or stateful logic in utils.

### TypeScript Configuration
All apps extend `@aria/tsconfig`:
- Backend: `@aria/tsconfig/nest.json`
- Frontends: `@aria/tsconfig/next.json`
- Packages: `@aria/tsconfig/base.json`

**Path aliases**:
- Backend: None (uses standard Node resolution)
- Frontends: `@asset/*`, `@crm/*`, `@hrms/*`, `@inventory/*` map to `./src/*`

## Code Patterns & Conventions

### Backend (NestJS)
- **Module organization**: Feature modules in `apps/backend/src/modules/<domain>`
- **Cross-cutting concerns**: Pipes, guards, interceptors in `apps/backend/src/common`
- **Keep controllers thin**: Delegate to services for business logic
- **Testing**: Jest for unit tests, e2e specs in `apps/backend/test/`

### Frontend (Next.js 15)
- **App Router**: All routes use `app/` directory structure
- **Server Components by default**: Client components only when needed (`'use client'`)
- **Tailwind 4 + PostCSS**: Configured with `@tailwindcss/postcss`
- **Turbopack**: Do NOT eject or modify webpack config
- **Environment vars**: Define in `next.config.ts` and app-specific `.env` files

### ESLint + Prettier Integration
Prettier runs **through ESLint** (not separately). Formatting violations show as lint errors.
- Shared config: `packages/config-eslint` with flat config format
- Fix formatting: `pnpm format` or `pnpm lint --fix`

## Workspace Management

### Adding New Apps
1. Create directory under `apps/<domain>/<name>`
2. Update `pnpm-workspace.yaml` to include path
3. Add Turborepo pipeline tasks in `turbo.json` if needed
4. Document scripts and env vars in app's README

### Adding New Packages
1. Create directory under `packages/<name>`
2. Add to `pnpm-workspace.yaml`
3. Define `package.json` with `name: "@aria/<name>"`
4. Export from `src/index.ts` for clean imports

### Dependency Management
- Add dependencies at **package level**, not root (except dev tools)
- Use `workspace:*` protocol for internal packages:
  ```json
  "dependencies": {
    "@aria/types": "workspace:*"
  }
  ```
- Run `pnpm install` at root after changes to refresh lockfile

## Testing Strategy

### Unit Tests (Vitest/Jest)
- Backend: Jest (configured in `apps/backend/package.json`)
- Frontend: Vitest (to be configured)
- Place tests adjacent to source: `feature.test.ts` or `component.test.tsx`

### Integration Tests
- Backend integration specs in `apps/backend/test/`
- Use in-memory services, stub external dependencies

### E2E Tests (Playwright)
- Plan: `apps/frontend/<app>/e2e/` directories
- Cover critical user flows: auth, CRUD, reporting
- Run in CI with headless browser

**Definition of Done**: Features require corresponding test coverage.

## CI/CD & Docker

### GitHub Actions (`.github/workflows/ci.yml`)
Runs on every push/PR to `main`/`master`:
1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm build`

**Extend CI when**:
- Adding new quality gates (Playwright, type generation)
- Introducing security scans or dependency audits

### Docker Compose (`docker-compose.yml`)
Production topology: Traefik reverse proxy + Postgres + backend + 4 frontends.
- Services depend on `postgres` health check
- Traefik handles SSL via Let's Encrypt
- Environment vars defined per service

**Local smoke test**: `docker compose up` (once Dockerfiles are ready)

## Common Pitfalls & Anti-Patterns

❌ **Avoid**:
- Duplicating configuration across apps (use shared packages)
- Adding business logic to controllers or React components
- Custom webpack/rollup configs (trust framework defaults)
- Manually creating files that CLIs generate
- Using `any` type or disabling TypeScript strict checks
- Committing without running `pnpm format && pnpm lint && pnpm build`

✅ **Do**:
- Run quality gates locally before opening PRs
- Update affected READMEs with new features/env vars
- Reference `AGENTS.md` agents in PR descriptions
- Keep Turborepo task outputs configured for cache efficiency
- Centralize types in `@aria/types`, utils in `@aria/utils`

## PR Checklist

Before submitting:
- [ ] `pnpm format` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` completes successfully
- [ ] Updated relevant README files
- [ ] Added/updated tests for new features
- [ ] PR description maps changes to agent responsibilities

## Quick Reference

| Task | Command |
|------|---------|
| Install dependencies | `pnpm install` |
| Format code | `pnpm format` |
| Lint entire workspace | `pnpm lint` |
| Run all tests | `pnpm test` |
| Build all apps | `pnpm build` |
| Start backend dev server | `pnpm --filter backend dev` |
| Start frontend dev server | `pnpm --filter <app> dev` |
| Generate NestJS module | `cd apps/backend && pnpm nest g module <name>` |
| Add workspace dependency | Edit package.json, use `"@aria/<pkg>": "workspace:*"` |

---

**When in doubt**: Follow framework conventions first, consult `AGENTS.md` for architectural principles, and keep changes simple and testable.
