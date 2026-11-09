# Aria ERP Copilot Instructions

> AI coding guidance for the Aria B2B ERP monorepo—a bun + Turborepo workspace hosting NestJS backend and four Next.js 15 frontends.

## ⛔ HARD RULE — Git Identity (DO NOT OVERRIDE)

The repository owner is **Karthik P** whose verified GitHub account is `Karthik-beta`.

- `user.name` = `Karthik P`
- `user.email` = `karthikpar@protonmail.com`

**AI agents MUST NOT**:
- Run `git config user.name` or `git config user.email` with any other values
- Set `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, or `GIT_COMMITTER_EMAIL` environment variables
- Use `--author` flags on `git commit`
- Modify `.git/config` in any way that affects the `[user]` section

Violating this rule causes commits to be attributed to a random service account instead of the real owner. The pre-commit hook will abort any commit made with wrong identity.

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
bun install

# Start individual apps
bun --filter backend dev        # NestJS on port 3000
bun --filter asset dev          # Next.js asset management
bun --filter crm dev            # Next.js CRM
bun --filter hrms dev           # Next.js HR
bun --filter inventory dev      # Next.js inventory

# Quality gates (must pass before PR)
bun format                      # Run Prettier across workspace
bun lint                        # ESLint with Prettier integration
bun test                        # All test suites
bun build                       # Production builds for all apps
```

### Scaffolding New Code

**Always use framework CLIs to generate code**:

```bash
# Backend (NestJS)
cd apps/backend
bun nest g module users         # Generate module
bun nest g controller users     # Generate controller
bun nest g service users        # Generate service

# Frontend (Next.js)
cd apps/frontend/asset
bunx next                        # Follow Next.js conventions
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
2. Import via `@aria/types` in consuming apps
3. **No build step required** — uses Just-in-Time (JIT) pattern

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

### Just-in-Time (JIT) Internal Packages

Shared packages follow Turborepo's recommended JIT pattern:

- **No manual build required** — packages export source TypeScript files directly
- **Instant hot reload** — changes to shared packages reflect immediately in consuming apps
- **Consuming apps handle transpilation** — Next.js uses `transpilePackages`, NestJS uses tsc
- **Type checking only** — run `bun --filter @aria/types check-types` for validation

See `SHARED_PACKAGES_REFACTOR.md` for detailed implementation.

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
- Fix formatting: `bun format` or `bun lint --fix`

## Workspace Management

### Adding New Apps

1. Create directory under `apps/<domain>/<name>`
2. Update `bun-workspace.yaml` to include path
3. Add Turborepo pipeline tasks in `turbo.json` if needed
4. Document scripts and env vars in app's README

### Adding New Packages

1. Create directory under `packages/<name>`
2. Add to `bun-workspace.yaml`
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
- Run `bun install` at root after changes to refresh lockfile

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

1. `bun install --frozen-lockfile`
2. `bun run lint`
3. `bun run test`
4. `bun run typecheck`
5. `bun run build`

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
- Committing without running `bun format`, `bun run lint`, `bun run test`, `bun run typecheck`, and `bun run build`

✅ **Do**:

- Run quality gates locally before opening PRs
- Update affected READMEs with new features/env vars
- Reference `AGENTS.md` agents in PR descriptions
- Keep Turborepo task outputs configured for cache efficiency
- Centralize types in `@aria/types`, utils in `@aria/utils`

## PR Checklist

Before submitting:

- [ ] `bun format` passes
- [ ] `bun run lint` passes
- [ ] `bun run test` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run build` completes successfully
- [ ] Updated relevant README files
- [ ] Added/updated tests for new features
- [ ] PR description maps changes to agent responsibilities

## Quick Reference

| Task                      | Command                                               |
| ------------------------- | ----------------------------------------------------- |
| Install dependencies      | `bun install`                                         |
| Format code               | `bun format`                                          |
| Lint entire workspace     | `bun run lint`                                        |
| Run all tests             | `bun run test`                                        |
| Run all type checks       | `bun run typecheck`                                   |
| Build all apps            | `bun run build`                                       |
| Start backend dev server  | `bun --filter backend dev`                            |
| Start frontend dev server | `bun --filter <app> dev`                              |
| Generate NestJS module    | `cd apps/backend && bun nest g module <name>`         |
| Add workspace dependency  | Edit package.json, use `"@aria/<pkg>": "workspace:*"` |

---

**When in doubt**: Follow framework conventions first, consult `AGENTS.md` for architectural principles, and keep changes simple and testable.
