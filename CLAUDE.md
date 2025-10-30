# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Setup & Installation

```bash
# Install all dependencies (run from project root)
bun install

# Start development servers
bun dev                    # Start all apps in dev mode
bun dev:full              # Start backend + database + Prisma Studio
```

### Application-Specific Commands

```bash
# Backend (NestJS)
bun --filter backend start:dev         # Start backend API (port 3000)
bun --filter backend db:start          # Start PostgreSQL database
bun --filter backend studio            # Open Prisma Studio
bun --filter backend test              # Run backend tests
bun --filter backend test:e2e          # Run end-to-end tests

# Frontend (Next.js)
bun --filter frontend dev              # Start frontend (port 3001)
bun --filter frontend test:e2e         # Run Playwright E2E tests
bun --filter frontend test:e2e:ui      # Run E2E tests with UI
```

### Quality Checks

```bash
bun format            # Format code with Prettier
bun lint              # Lint code with ESLint
bun test              # Run all tests
bun build             # Build all applications
bun check-types       # Type-check all packages
```

### Database Operations

```bash
# From backend directory
cd apps/backend
bun db:generate       # Generate Prisma client
bun db:push           # Push schema changes to database
bun db:migrate        # Create and run migrations
```

### Deployment

```bash
bun package           # Build deployment package
```

## Monorepo Architecture

Aria ERP is a **bun + Turborepo monorepo** containing:

### Apps

- **`apps/backend`** - NestJS 11 API server (Node.js 20/22)
  - Handles business logic, database operations, and authentication
  - Modules: `auth`, `assets`, `crm`, `hrms`, `inventory`
  - Uses Prisma ORM with PostgreSQL
  - Implements tRPC for type-safe APIs

- **`apps/frontend`** - Next.js 16 application (React 19, App Router)
  - Four business modules served from single app with route-based routing:
    - `/asset` - Asset management (port 3001)
    - `/crm` - Customer relations (port 3002)
    - `/hrms` - Human resources (port 3003)
    - `/inventory` - Inventory control (port 3004)
  - Uses tRPC React Query for data fetching
  - UI: Tailwind CSS 4 + Radix UI + shadcn/ui components
  - Authentication via better-auth

### Shared Packages

- **`@aria/types`** (`packages/types/`)
  - Source of truth for all TypeScript types
  - Exports domain namespaces (Asset, Inventory, etc.)
  - Must be built after changes: `bun --filter @aria/types build`

- **`@aria/utils`** (`packages/utils/`)
  - Pure, deterministic helper functions
  - No side effects or I/O operations

- **`@aria/tsconfig`** (`packages/config-typescript/`)
  - Shared TypeScript compiler settings
  - All apps extend from this

- **`@aria/eslint-config`** (`packages/config-eslint/`)
  - Shared ESLint configuration (flat config)

### Deployment

- **`deployment/`** - Production deployment toolkit
  - Docker Compose configuration
  - Caddy reverse proxy for path-based routing
  - Caddy v2 for HTTP/3 support
  - Cross-platform deployment scripts (Windows PowerShell)

## Key Development Principles

### From AGENTS.md (Development Philosophy)

**Simplicity Advocate**

- Use framework defaults: `nest g` for NestJS, `bunx next` for Next.js
- Centralize configuration in shared packages
- Keep controllers thin, logic in services
- Avoid bespoke configurations unless necessary

**Type Safety Guardian**

- All TypeScript configs extend `@aria/tsconfig`
- Domain types originate in `packages/types/src`
- Maintain zero `any` leakage
- Use path aliases: `@aria/types`, `@aria/utils`, `@asset/*`

**Automation Steward**

- All quality checks scripted in package.json
- CI pipeline mirrors local workflows
- Turborepo handles caching and task orchestration
- Use workspace scripts over ad-hoc commands

### Code Organization Patterns

**Backend (`apps/backend/`)**

```
src/
├── main.ts                    # Entry point
├── app.module.ts              # Root module
├── modules/                   # Feature modules
│   ├── auth/                  # Authentication
│   ├── assets/                # Asset management
│   ├── crm/                   # Customer relations
│   ├── hrms/                  # Human resources
│   └── inventory/             # Inventory
├── common/                    # Shared utilities
│   ├── guards/                # Auth guards
│   ├── pipes/                 # Validation pipes
│   └── interceptors/          # HTTP interceptors
├── shared/                    # Shared business logic
└── trpc/                      # tRPC router definitions
```

**Frontend (`apps/frontend/`)**

```
src/
├── app/                       # Next.js App Router
│   ├── (auth)/               # Auth route group
│   ├── asset/                # Asset module routes
│   ├── crm/                  # CRM module routes
│   ├── hrms/                 # HRMS module routes
│   └── inventory/            # Inventory module routes
├── components/               # Shared UI components
├── features/                 # Feature-based components
├── lib/                      # Utilities and configurations
├── hooks/                    # Custom React hooks
└── types/                    # TypeScript type definitions
```

### Shared Type System

The `@aria/types` package is the **single source of truth** for all types:

```typescript
// Import types
import type { Asset, Inventory, User } from '@aria/types';

// Domain namespaces are exported separately
export * from '@aria/types/src/asset';
export * from '@aria/types/src/inventory';
export * from '@aria/types/src/auth';
```

After modifying types, rebuild:

```bash
bun --filter @aria/types build
```

### tRPC Integration

Backend and frontend communicate via tRPC:

- **Backend routers** - Define in `apps/backend/src/trpc/routers/`
- **Frontend client** - Configure in `apps/frontend/src/lib/trpc/`
- **Type safety** - End-to-end types from `@aria/types`
- **React Query** - For caching and mutations

### Authentication Flow

- **Library**: better-auth
- **Configuration**: `apps/frontend/src/lib/auth.ts`
- **Cross-site cookies**: Enabled for multi-domain deployment
- **Session handling**: Automatic token refresh
- **Guard usage**: Protect routes with authentication checks

### Testing Strategy

**Backend**

- Unit tests: Jest (`.spec.ts` files)
- E2E tests: `test/jest-e2e.json`

**Frontend**

- Unit tests: Vitest
- E2E tests: Playwright (`.spec.ts` files in `tests/`)

**Running Tests**

```bash
# All tests
bun test

# Single package
bun --filter backend test
bun --filter frontend test

# With coverage
bun --filter backend test:cov
```

### Environment Configuration

Root `.env` files:

- `.env.development.template` - Development template
- `.env.production.template` - Production template
- `.env.example` - General example

**Important Variables:**

```
BACKEND_URL              # Backend API URL
NEXT_PUBLIC_API_URL      # Public API URL for frontend
DATABASE_URL             # PostgreSQL connection string
BETTER_AUTH_SECRET       # Auth secret key
```

## Common Development Tasks

### Adding a New Feature

1. **Create backend module** (if needed):

   ```bash
   cd apps/backend
   bun nest g module features/new-feature
   bun nest g controller features/new-feature
   bun nest g service features/new-feature
   ```

2. **Add tRPC router** (if needed):
   - Create router in `src/trpc/routers/`
   - Export from `src/trpc/root.ts`

3. **Update types**:
   - Add types to `packages/types/src/`
   - Rebuild: `bun --filter @aria/types build`

4. **Create frontend routes**:
   - Add pages in `apps/frontend/src/app/new-feature/`

5. **Write tests**:
   - Backend: `.spec.ts` file
   - Frontend: `.spec.ts` in `tests/` directory

### Modifying Types

Types live in `packages/types/src/`:

```typescript
// Example: Adding to asset domain
export interface Asset {
  id: string;
  name: string;
  // ... fields
}
```

Then rebuild and update consumers:

```bash
bun --filter @aria/types build
bun check-types  # Verify no type errors
```

### Database Changes

1. Modify Prisma schema: `apps/backend/prisma/schema.prisma`
2. Generate migration:
   ```bash
   cd apps/backend
   bun prisma migrate dev --name describe_change
   ```
3. Generate client: `bun db:generate`

### Adding Dependencies

```bash
# Add to specific app
bun --filter backend add package-name

# Add to shared package
bun --filter @aria/types add package-name

# Add as dev dependency
bun --filter frontend add -D package-name
```

Always commit `bun.lockb` changes!

### Path Aliases

Configured in `tsconfig.json`:

- `@aria/types` → `packages/types/src`
- `@aria/utils` → `packages/utils/src`
- `@asset/*` → `apps/frontend/src/asset/*`
- `@lib/*` → `apps/frontend/src/lib/*`

Update `tsconfig.json` and `eslint.config.mjs` together when adding aliases.

## Quality Gates

Before committing:

- [ ] `bun format` passes
- [ ] `bun lint` passes
- [ ] `bun test` passes
- [ ] `bun build` succeeds
- [ ] `bun check-types` passes

All changes must maintain type safety and avoid `any` types.

## Important Configuration Files

- **Turborepo**: `turbo.json` - Build orchestration
- **Workspaces**: `bun-workspace.yaml` - Package definitions
- **TypeScript**: `packages/config-typescript/` - Compiler settings
- **ESLint**: `packages/config-eslint/` - Lint rules
- **Next.js**: `apps/frontend/next.config.ts` - Framework config
- **Prisma**: `apps/backend/prisma/schema.prisma` - Database schema

## Documentation References

- **Architecture**: `docs/architecture.md`
- **Getting Started**: `docs/getting-started.md`
- **Backend Guide**: `apps/backend/README.md`
- **Contributing**: `CONTRIBUTING.md`
- **Deployment**: `deployment/README.md`
- **Development Philosophy**: `AGENTS.md`
