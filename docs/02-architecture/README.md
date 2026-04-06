# Aria ERP Architecture

Technical overview of the Aria ERP system design, architecture, and development principles.

## System Overview

Aria ERP is a modular, type-safe B2B ERP suite built as a Bun + Turborepo monorepo. The system comprises:

- **1 Backend API** — NestJS 11 service with tRPC endpoints
- **1 Frontend Application** — Next.js App Router with route groups
- **Shared Packages** — API contract, types, utilities, and TypeScript configs
- **Deployment Toolkit** — Docker Compose with Caddy reverse proxy and monitoring

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Browser                       │
└────────────┬────────────────────────────────────────────────┘
             │ HTTPS
             ▼
┌─────────────────────────────────────────────────────────────┐
│              Caddy v2 (Reverse Proxy, HTTP/3)               │
│                    Path-Based Routing                        │
└──────┬──────────────────────────────────────────┬───────────┘
       │ /api/*, /trpc/*, /trpc-ws                │ everything else
       ▼                                          ▼
┌────────────────────┐                 ┌────────────────────┐
│ Backend (NestJS)   │                 │ Frontend (Next.js) │
│ Port 3001          │                 │ Port 3000          │
│                    │                 │ Route Groups:      │
│ ┌────────────────┐ │                 │  /admin            │
│ │ tRPC Routers   │ │                 │  /asset            │
│ │  • inventory   │ │  ◄── tRPC ──►  │  /crm              │
│ │  • admin       │ │                 │  /hrms             │
│ │  • authorization│ │                │  /inventory        │
│ │  • account     │ │                 └────────────────────┘
│ └────────┬───────┘ │
│          │         │
│ ┌────────▼───────┐ │
│ │ better-auth    │ │
│ │ (sessions)     │ │
│ └────────┬───────┘ │
│          │         │
│ ┌────────▼───────┐ │
│ │ Prisma 7       │ │
│ │ (PrismaPg)     │ │
│ └────────┬───────┘ │
└──────────┼─────────┘
           │
    ┌──────▼───────┐      ┌──────────────┐
    │ PostgreSQL   │      │ Redis        │
    │ Port 5432    │      │ Port 6379    │
    └──────────────┘      └──────────────┘
```

## Technology Stack

### Backend

| Concern | Technology |
|---------|-----------|
| Framework | NestJS 11 |
| Runtime | Node.js 20/22 |
| Language | TypeScript (strict mode) |
| API | tRPC |
| Database | PostgreSQL with Prisma 7 ORM (PrismaPg adapter) |
| Authentication | better-auth (email+password, username plugin) |
| Authorization | Custom RBAC + ABAC system |
| Testing | Jest (unit + integration) |

### Frontend

| Concern | Technology |
|---------|-----------|
| Framework | Next.js (App Router, Turbopack) |
| UI Library | React |
| Styling | Tailwind CSS 4 with PostCSS |
| UI Components | shadcn/ui + Radix UI |
| API Client | tRPC + TanStack Query |
| Testing | Vitest (unit), Playwright (E2E) |

### Shared Infrastructure

| Concern | Technology |
|---------|-----------|
| Package Manager | Bun 1.3.x |
| Build Orchestration | Turborepo |
| Code Quality | Biome (linting + formatting) |
| Type System | TypeScript 5.x |
| Reverse Proxy | Caddy v2 |
| Containerization | Docker + Docker Compose |
| Monitoring | Prometheus + Grafana + cAdvisor |

## Monorepo Structure

### Applications (`apps/`)

#### Backend (`apps/backend/`)

NestJS API server providing tRPC endpoints for the frontend application.

**Key Directories:**

```
apps/backend/
├── src/
│   ├── apps/             # Feature modules
│   │   └── inventory/    # Inventory module (services, router, tests)
│   ├── auth/             # better-auth configuration and service
│   ├── authorization/    # RBAC/ABAC policy, role, permission services
│   ├── trpc/             # tRPC router assembly and context
│   │   ├── app-router.ts # Top-level router (inventory + admin + auth + account)
│   │   ├── trpc.ts       # tRPC init, middleware, procedures
│   │   ├── trpc.context.ts # Request context with Prisma
│   │   └── routers/      # Admin, authorization, account routers
│   ├── shared/           # Shared services (PrismaService, etc.)
│   └── generated/        # Prisma-generated client
├── prisma/
│   ├── schema.prisma     # Database schema (Prisma v7)
│   ├── migrations/       # Database migrations
│   ├── seed-authorization.ts # Seed roles, permissions, apps
│   ├── seeds/            # Additional seed scripts
│   └── demo-data/        # Demo data system (CLI + orchestrator + README)
└── test/                 # Integration tests
```

**Principles:**

- Feature modules live in `src/apps/<domain>`
- Each module has dedicated services in a `services/` directory
- A single tRPC router per module exposes all procedures
- Cross-cutting concerns (auth, authorization) are at the top level

#### Frontend (`apps/frontend/`)

Single Next.js application using App Router with route groups. Protected layouts resolve auth on the server and hydrate client components from a single auth snapshot:

| Route Group | Path | Description |
|-------------|------|-------------|
| Admin | `/admin` | User, role, permission management + audit logs |
| Asset | `/asset` | Asset management and tracking |
| CRM | `/crm` | Customer relationship management |
| HRMS | `/hrms` | Human resources and payroll |
| Inventory | `/inventory` | Inventory control and warehousing |

**Structure:**

```
apps/frontend/
├── src/
│   ├── app/              # App Router pages
│   │   ├── layout.tsx    # Root layout (TRPCProvider; auth resolved in route-group layouts)
│   │   ├── admin/        # Admin console
│   │   ├── asset/        # Asset module
│   │   ├── crm/          # CRM module
│   │   ├── hrms/         # HRMS module
│   │   ├── inventory/    # Inventory module
│   │   └── auth/         # Authentication pages
│   ├── components/       # Shared UI components (shadcn/ui)
│   ├── features/         # Feature-specific components
│   ├── lib/              # Utilities and tRPC client setup
│   └── hooks/            # Custom React hooks
├── e2e/                  # Playwright E2E tests
└── test/                 # Vitest unit tests
```

**Principles:**

- Server Components by default
- Client Components only when needed (`'use client'`)
- shadcn/ui components live within the frontend app (no separate UI package)
- tRPC client provides type-safe API calls via TanStack Query

### Shared Packages (`packages/`)

#### @aria/api-contract

**Type-only tRPC contract layer.** This package exports the `AppRouter` type and context types that both backend and frontend consume. The backend verifies its implementation satisfies the contract at compile time.

```typescript
// packages/api-contract/src/index.ts
export type { AppRouter } from "./trpc/app-router";
export type { TrpcContextType, TrpcPrismaClient } from "./trpc/trpc.context";
```

The backend uses `AssertContractCompatibility` type-level checks to ensure the runtime router matches the contract.

#### @aria/types

Central repository for shared TypeScript type definitions and Zod schemas.

```typescript
// packages/types/src/index.ts
export interface Pagination { page: number; pageSize: number; }
export interface ApiResponse<T> { data: T; pagination?: Pagination; }

export namespace Inventory {
  export interface ItemGroup { /* ... */ }
  export interface Brand { /* ... */ }
  export interface UnitOfMeasure { /* ... */ }
  // + Zod schemas for validation
}
```

#### @aria/utils

Pure, deterministic utility functions with no side effects.

```typescript
// packages/utils/src/index.ts
export const paginate = (items: unknown[], { page, pageSize }: Pagination) => { /* ... */ };
export { logger } from "./logger";
```

#### @aria/tsconfig

Shared TypeScript compiler configurations:

| Config | Used By |
|--------|---------|
| `base.json` | Shared packages |
| `nest.json` | Backend |
| `next.json` | Frontend |

## Just-in-Time (JIT) Internal Packages

Shared packages follow Turborepo's recommended JIT pattern:

- **No manual build required** — packages export source TypeScript files directly
- **Instant hot reload** — changes to shared packages reflect immediately in consuming apps
- **Consuming apps handle transpilation** — Next.js uses `transpilePackages`, NestJS uses tsc
- **Type checking only** — run `bun --filter @aria/types check-types` for validation

## Data Flow

### Frontend → Backend Communication

```
Frontend (Next.js)
    │
    │ tRPC (HTTP or WebSocket)
    ▼
tRPC Router (NestJS)  ← Validates input with Zod
    │
    ▼
Service Layer         ← Business logic
    │
    ▼
Prisma 7 (PrismaPg)  ← Database access
    │
    ▼
PostgreSQL
```

### Type Safety Chain

The `@aria/api-contract` package ensures end-to-end type safety:

1. **Backend** defines tRPC routers with Zod input/output schemas
2. **Contract** package exports the `AppRouter` type
3. **Frontend** imports `AppRouter` to create type-safe tRPC client
4. Any router change that breaks the contract causes a compile-time error on both sides

### Authentication Flow

1. User submits credentials to the frontend auth page
2. Frontend calls better-auth API on the backend (`/api/auth/*`)
3. better-auth validates credentials and creates a session cookie
4. Subsequent tRPC calls include the session cookie
5. tRPC `isAuthenticated` middleware validates the session via better-auth
6. Authenticated context (user + session) is passed to procedures

## Deployment Architecture

### Production Topology

```
┌──────────────────────────────────────────────┐
│         Docker Host (Linux/Windows)          │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  Caddy v2 (Reverse Proxy)             │  │
│  │  - Auto HTTPS (local certs)            │  │
│  │  - HTTP/3 enabled                      │  │
│  │  - Security headers                    │  │
│  └──────┬─────────────┬──────────────────┘  │
│         │             │                      │
│   /api, /trpc    everything else             │
│         │             │                      │
│  ┌──────▼──────┐ ┌────▼─────────┐           │
│  │ Backend     │ │ Frontend     │           │
│  │ (3001)      │ │ (3000)       │           │
│  └──────┬──────┘ └──────────────┘           │
│         │                                    │
│  ┌──────▼──────┐ ┌──────────────┐           │
│  │ PostgreSQL  │ │ Redis        │           │
│  │ (5432)      │ │ (6379)       │           │
│  └─────────────┘ └──────────────┘           │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │ Monitoring                          │    │
│  │  Prometheus (9090)                  │    │
│  │  Grafana (3000)                     │    │
│  │  cAdvisor (8080)                    │    │
│  │  Node Exporter (9100)              │    │
│  └─────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

### Path-Based Routing (Caddy)

| URL Path  | Destination | Description |
|-----------|-------------|-------------|
| `/health` | Caddy direct | Health check (responds 200) |
| `/api/*`  | backend:3001 | better-auth and API endpoints |
| `/trpc/*` | backend:3001 | tRPC HTTP requests |
| `/trpc-ws` | backend:3001 | tRPC WebSocket (real-time) |
| `/*`      | frontend:3000 | Next.js (all other routes) |
