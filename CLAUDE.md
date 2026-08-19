# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `Karthik-beta/Aria`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: use the root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

## Package Manager: Bun Only

**Always use Bun** — never npm, pnpm, or yarn. This repository is configured for Bun.

```bash
# Install dependencies
bun install

# Add a dependency
bun add <package>
bun add -D <package>

# Remove a dependency
bun remove <package>
```

## Git Identity (HARD RULE)

Repository owner is **Karthik P** (GitHub: `Karthik-beta`). Never change git config:
- `user.name` = `Karthik P`
- `user.email` = `karthikpar@protonmail.com`

## Development Commands

```bash
# Start development servers
bun --filter backend dev          # NestJS API on port 3000
bun --filter frontend dev        # Next.js on port 3000

# Quality gates (run ALL before PR)
bun format                        # Format with Biome
bun run lint                      # Lint checks
bun run test                      # Unit and integration tests
bun run typecheck                 # TypeScript checking
bun run build                     # Production builds
bun run validate                  # All checks at once

# Run a single test
bun --filter backend test -- <test-file-pattern>

# Generate NestJS code
cd apps/backend && bun nest g module <name>
cd apps/backend && bun nest g service <name>
cd apps/backend && bun nest g controller <name>
```

## Architecture

**Monorepo**: Bun + Turborepo workspace with NestJS backend and Next.js 15 frontend.

```
apps/
├── backend/       # NestJS 11 API (tRPC, Prisma, PostgreSQL)
│   └── src/
│       ├── apps/<domain>/    # Feature services (inventory, asset, etc.)
│       ├── modules/<domain>/ # Nest feature modules
│       └── common/           # Guards, pipes, interceptors, decorators
└── frontend/     # Next.js 15 App Router (route groups below)
    └── src/app/
        ├── asset/    # Asset management
        ├── crm/      # CRM
        ├── hrms/     # HRMS
        └── inventory/ # Inventory

packages/
├── types/         # @aria/types - shared type definitions (single source of truth)
├── utils/         # @aria/utils - pure helper functions
├── api-contract/  # tRPC contract layer
└── config-typescript/  # TypeScript configs (@aria/tsconfig)
```

## Key Patterns

### Shared Types
All cross-app contracts originate in `packages/types/src/index.ts`. Import via `@aria/types`. Update this file first when adding shared types across apps.

### Backend Organization
- Feature services in `src/apps/<domain>/`
- Nest modules generated via CLI in `src/modules/<domain>`
- Keep controllers thin; business logic in services
- Shared utilities in `src/common/`

### Frontend Organization
- Route groups under `src/app/` (asset, crm, hrms, inventory)
- Server Components by default; use `'use client'` only when needed for hooks or browser APIs
- Path aliases: `@asset/*`, `@crm/*`, `@hrms/*`, `@inventory/*` map to `./src/*`

### Code Quality
- Biome for formatting/linting (not ESLint/Prettier)
- `bun format` - auto-format all code
- `bun run lint --fix` - auto-fix lint issues

## TypeScript Configuration

All apps extend shared TypeScript configs:
- Backend: `@aria/tsconfig/nest.json`
- Frontend: `@aria/tsconfig/next.json`
- Packages: `@aria/tsconfig/base.json`

## Zod Schemas

Validation schemas live in `packages/types/src/index.ts` under domain namespaces. Use these for:
- API request/response validation
- Form validation on frontend
- Database input sanitization

## Prisma

Database schema at `apps/backend/prisma/schema.prisma`. After changes:
```bash
bun --filter backend prisma:generate
```

## Adding Dependencies

When adding internal dependencies, use workspace protocol:
```json
"@aria/types": "workspace:*"
```

Then run `bun install` at root.

## Branch Naming

- `feature/<description>` - New features
- `fix/<description>` - Bug fixes
- `refactor/<description>` - Code refactoring
- `chore/<description>` - Maintenance
