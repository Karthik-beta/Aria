# Aria ERP Architecture

Technical overview of the Aria ERP system design, architecture, and development principles.

## System Overview

Aria ERP is a modular, type-safe B2B ERP suite built as a bun + Turborepo monorepo. The system comprises:

- **1 Backend API** - NestJS 11 service
- **1 Frontend Application** - Next.js 16 App Router with route groups
- **Shared Packages** - Common types, utilities, and configurations
- **Deployment Toolkit** - Cross-platform Docker-based installer

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Browser                       │
└────────────┬────────────────────────────────────────────────┘
             │ HTTPS
             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Caddy (Reverse Proxy)                     │
│                    Path-Based Routing                        │
└─┬────────────┬────────────┬──────────┬────────────────┬──────┘
  │            │            │          │                │
  │/asset      │/crm        │/hrms     │/inventory      │/api
  │            │            │          │                │
  └────────────┴────────────┴──────────┴────────────────┘
                       │
                       ▼
            ┌────────────────────┐
            │ Frontend (Next.js) │
            │  Route Groups      │
            └──────────┬─────────┘
                       │
                       ▼
            ┌────────────────────┐
            │ Backend (NestJS)   │
            └──────────┬─────────┘
                       │
                       ▼
            ┌────────────────────┐
            │   PostgreSQL       │
            └────────────────────┘
```

## Technology Stack

### Backend

- **Framework**: NestJS 11
- **Runtime**: Node.js 20/22
- **Language**: TypeScript (strict mode)
- **API**: tRPC
- **Database**: PostgreSQL with Prisma ORM
- **Testing**: Jest (unit + e2e)

### Frontend

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 18+
- **Styling**: Tailwind CSS 4 with PostCSS
- **Build Tool**: Turbopack (default Next.js)
- **Language**: TypeScript (strict mode)

### Shared Infrastructure

- **Package Manager**: bun 1.3.x
- **Build Orchestration**: Turborepo
- **Code Quality**: ESLint (flat config) + Prettier
- **Type System**: TypeScript 5.x
- **Reverse Proxy**: Caddy v3.5
- **Containerization**: Docker + Docker Compose

## Monorepo Structure

### Applications (`apps/`)

#### Backend (`apps/backend/`)

NestJS API server providing tRPC endpoints for all frontend applications.

**Key Directories:**

```
apps/backend/
├── src/
│   ├── modules/          # Feature modules (users, products, etc.)
│   ├── common/           # Shared pipes, guards, interceptors
│   ├── app.module.ts     # Root module
│   └── main.ts           # Application entry point
└── test/                 # Integration tests
```

**Principles:**

- Use `nest g` CLI for scaffolding
- Keep controllers thin, logic in services
- Feature modules in `src/modules/<domain>`
- Cross-cutting concerns in `src/common/`

#### Frontends (`apps/frontend/`)

Single Next.js 16 application using App Router with route groups:

- **Asset** - `/asset` route group - Asset management and tracking
- **CRM** - `/crm` route group - Customer relationship management
- **HRMS** - `/hrms` route group - Human resources and payroll
- **Inventory** - Inventory control and warehousing

**Structure (example: asset):**

```
apps/frontend/asset/
├── src/
│   ├── app/              # App Router pages
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   └── components/       # React components
├── public/               # Static assets
└── next.config.ts        # Next.js configuration
```

**Principles:**

- Server Components by default
- Client Components only when needed (`'use client'`)
- Use app-specific path aliases (`@asset/*`)
- Share nothing between frontends directly

### Shared Packages (`packages/`)

#### @aria/types

Central repository for all TypeScript type definitions shared across backend and frontends.

```typescript
// packages/types/src/index.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

export namespace Inventory {
  export interface Item {
    id: string;
    sku: string;
    quantity: number;
  }
}
```

**Usage:**

```typescript
import { User, Inventory } from '@aria/types';
```

#### @aria/utils

Pure, deterministic utility functions with no side effects.

```typescript
// packages/utils/src/index.ts
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
```

**Rules:**

- ✅ Pure functions only
- ✅ No I/O operations
- ✅ No network calls
- ✅ Deterministic outputs

#### @aria/tsconfig

Shared TypeScript compiler configurations.

```
packages/config-typescript/
├── base.json          # Base config for packages
├── nest.json          # NestJS-specific config
└── next.json          # Next.js-specific config
```

**Usage in apps:**

```json
{
  "extends": "@aria/tsconfig/nest.json",
  "compilerOptions": {
    "outDir": "./dist"
  }
}
```

#### @aria/eslint-config

Flat config ESLint presets with Prettier integration.

```
packages/config-eslint/
├── base.js           # Base rules
├── nest.js           # NestJS-specific rules
└── next.js           # Next.js-specific rules
```

## Just-in-Time (JIT) Internal Packages

Shared packages follow Turborepo's recommended JIT pattern:

- **No manual build required** — packages export source TypeScript files directly
- **Instant hot reload** — changes to shared packages reflect immediately in consuming apps
- **Consuming apps handle transpilation** — Next.js uses `transpilePackages`, NestJS uses tsc
- **Type checking only** — run `pnpm --filter @aria/types check-types` for validation

## Data Flow

### Frontend → Backend Communication

```
┌─────────────┐
│   Frontend  │
│  (Next.js)  │
└──────┬──────┘
       │ tRPC
       │
       ▼
┌─────────────┐
│   tRPC Router │ ← Validates with Zod
│  (NestJS)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Service   │ ← Business logic
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Prisma    │ ← Database access
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  PostgreSQL │
└─────────────┘
```

### Type Sharing

```typescript
// 1. Define in @aria/types
export interface CreateUserDto {
  name: string;
  email: string;
}

// 2. Import in backend
import { CreateUserDto } from '@aria/types';

@Controller('users')
export class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}

// 3. Import in frontend
import { CreateUserDto } from '@aria/types';

const user: CreateUserDto = {
  name: 'John',
  email: 'john@example.com',
};

await trpc.createUser.mutate(user);
```

## Deployment Architecture

### Production Topology

```
┌──────────────────────────────────────────────┐
│         Docker Host (Linux/Windows)          │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Caddy (Reverse Proxy)               │ │
│  │  - SSL termination (Let's Encrypt)     │ │
│  │  - Path-based routing                  │ │
│  │  - Security headers                    │ │
│  └──────┬─────────────────────────────────┘ │
│         │                                    │
│  ┌──────┴──────────┐    Docker Network      │
│  │                 │    (Internal)          │
│  ├─────────────────┤                        │
│  │ Backend (3000)  ├──┐                     │
│  ├─────────────────┤  │                     │
│  │ Asset (3001)    │  │                     │
│  ├─────────────────┤  │                     │
│  │ CRM (3002)      │  │                     │
│  ├─────────────────┤  │                     │
│  │ HRMS (3003)     │  │                     │
│  ├─────────────────┤  │                     │
│  │ Inventory(3004) │  │                     │
│  └─────────────────┘  │                     │
│                       │                     │
│  ┌────────────────────┴──┐                  │
│  │  PostgreSQL (5432)    │                  │
│  │  - Data persistence   │                  │
│  │  - Volume mounted     │                  │
│  └───────────────────────┘                  │
└──────────────────────────────────────────────┘
```

### Path-Based Routing

| URL Path      | Service          | Port |
| ------------- | ---------------- | ---- |
| `/`           | Asset Management | 3001 |
| `/crm/`       | CRM              | 3002 |
| `/hrms/`      | HRMS             | 3003 |
| `/inventory/` | Inventory        | 3004 |
| `/api/`       | Backend API      | 3000 |

### Resource Allocation

**Default Limits:**

- **Caddy**: 0.5 CPU, 512MB RAM
- **Backend**: 1 CPU, 1GB RAM
- **Each Frontend**: 0.5 CPU, 512MB RAM
- **PostgreSQL**: 2 CPU, 2GB RAM

**Scaling for ~200 concurrent users:**

- Total: 4.5 CPU cores, 5.5GB RAM
