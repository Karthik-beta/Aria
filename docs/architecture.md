# Aria ERP Architecture

Technical overview of the Aria ERP system design, architecture, and development principles.

## System Overview

Aria ERP is a modular, type-safe B2B ERP suite built as a pnpm + Turborepo monorepo. The system comprises:

- **1 Backend API** - NestJS 11 service
- **4 Frontend Applications** - Next.js 15 App Router apps
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
│                    Traefik (Reverse Proxy)                   │
│                    Path-Based Routing                        │
└─┬─────────┬──────────┬──────────┬──────────┬────────────────┘
  │         │          │          │          │
  │/asset   │/crm      │/hrms     │/inventory│/api
  ▼         ▼          ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌─────────┐
│ Asset │ │  CRM  │ │ HRMS  │ │Invent │ │ Backend │
│Next.js│ │Next.js│ │Next.js│ │Next.js│ │ NestJS  │
└───────┘ └───────┘ └───────┘ └───────┘ └────┬────┘
                                              │
                                              ▼
                                        ┌──────────┐
                                        │PostgreSQL│
                                        └──────────┘
```

## Technology Stack

### Backend

- **Framework**: NestJS 11
- **Runtime**: Node.js 20/22
- **Language**: TypeScript (strict mode)
- **Testing**: Jest (unit + e2e)
- **Database**: PostgreSQL (planned)

### Frontend

- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 18+
- **Styling**: Tailwind CSS 4 with PostCSS
- **Build Tool**: Turbopack (default Next.js)
- **Language**: TypeScript (strict mode)

### Shared Infrastructure

- **Package Manager**: pnpm 10.x
- **Build Orchestration**: Turborepo
- **Code Quality**: ESLint (flat config) + Prettier
- **Type System**: TypeScript 5.x
- **Reverse Proxy**: Traefik v3.5
- **Containerization**: Docker + Docker Compose

## Monorepo Structure

### Applications (`apps/`)

#### Backend (`apps/backend/`)

NestJS API server providing REST endpoints for all frontend applications.

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

Four Next.js 15 applications using App Router:

- **Asset** - Asset management and tracking
- **CRM** - Customer relationship management
- **HRMS** - Human resources and payroll
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

## Development Agents

Aria follows a **four-agent philosophy** to maintain code quality. Each agent guards a specific aspect:

### 1. Simplicity Advocate

**Mission**: Keep complexity minimal.

- Use framework CLI generators (`nest g`, `pnpx next`)
- Avoid custom configuration unless necessary
- Centralize shared config in packages
- Follow framework conventions first

### 2. Type Safety Guardian

**Mission**: Enforce strong typing.

- All types defined in `@aria/types`
- Strict TypeScript mode enabled
- No `any` types allowed
- Consistent type usage across apps

### 3. Automation Steward

**Mission**: Maintain reproducible workflows.

- All tasks exposed via `package.json` scripts
- Turborepo caching configured
- CI mirrors local development exactly
- Environment reproducibility

### 4. Quality Sentinel

**Mission**: Embed quality gates.

- Tests accompany features
- Coverage expectations maintained
- Accessibility standards enforced
- Code reviews required

See [AGENTS.md](../AGENTS.md) for detailed guidelines.

## Design Patterns

### Backend Patterns

#### Module Organization

```
apps/backend/src/modules/users/
├── dto/
│   ├── create-user.dto.ts
│   └── update-user.dto.ts
├── entities/
│   └── user.entity.ts
├── users.controller.ts
├── users.service.ts
└── users.module.ts
```

#### Dependency Injection

```typescript
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly emailService: EmailService
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    // Business logic here
    const user = await this.usersRepository.create(createUserDto);
    await this.emailService.sendWelcomeEmail(user.email);
    return user;
  }
}
```

### Frontend Patterns

#### Server Components (Default)

```tsx
// app/users/page.tsx
export default async function UsersPage() {
  const users = await fetchUsers(); // Server-side fetch

  return (
    <div>
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}
```

#### Client Components (When Needed)

```tsx
'use client';

import { useState } from 'react';

export function InteractiveButton() {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
}
```

#### Path Aliases

```typescript
// Use path aliases for cleaner imports
import { UserCard } from '@asset/components/UserCard';
import { formatDate } from '@asset/lib/utils';

// Instead of relative paths
import { UserCard } from '../../components/UserCard';
```

## Data Flow

### Frontend → Backend Communication

```
┌─────────────┐
│   Frontend  │
│  (Next.js)  │
└──────┬──────┘
       │ HTTP Request
       │ (fetch/axios)
       ▼
┌─────────────┐
│  Controller │ ← Validates with DTOs
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
│ Repository  │ ← Database access
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

await fetch('/api/users', {
  method: 'POST',
  body: JSON.stringify(user),
});
```

## Deployment Architecture

### Production Topology

```
┌──────────────────────────────────────────────┐
│         Docker Host (Linux/Windows)          │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Traefik (Reverse Proxy)               │ │
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

- **Traefik**: 0.5 CPU, 512MB RAM
- **Backend**: 1 CPU, 1GB RAM
- **Each Frontend**: 0.5 CPU, 512MB RAM
- **PostgreSQL**: 2 CPU, 2GB RAM

**Scaling for ~200 concurrent users:**

- Total: 4.5 CPU cores, 5.5GB RAM

## Security Considerations

### SSL/TLS

- **Development**: Self-signed certificates in `traefik/certs/`
- **Production**: Let's Encrypt via Traefik or custom CA certificates

### Secrets Management

- Never commit secrets to Git
- Use environment variables at runtime
- Store in `.env` files (excluded from Git)
- Production: Use Docker secrets or external vaults

### Network Security

- Internal services communicate via Docker network
- Only Traefik exposed to internet (ports 80, 443)
- Application ports not exposed to host

See [SECURITY.md](../SECURITY.md) for complete security guidelines.

## Testing Strategy

### Unit Tests

- **Location**: Adjacent to source files (`*.spec.ts`)
- **Framework**: Jest (backend), Vitest (frontend, planned)
- **Coverage**: Business logic, services, utilities

### Integration Tests

- **Location**: `apps/backend/test/`
- **Scope**: API endpoints, database interactions
- **Framework**: Jest with Supertest

### E2E Tests

- **Location**: `apps/frontend/<app>/e2e/` (planned)
- **Framework**: Playwright
- **Scope**: Critical user flows

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  quality:
    - pnpm install
    - pnpm format --check
    - pnpm lint
    - pnpm test
    - pnpm build
```

## Performance Considerations

### Turborepo Caching

Turborepo caches task outputs to speed up builds:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    }
  }
}
```

### Next.js Optimizations

- **Turbopack**: Fast development builds
- **Server Components**: Reduced client JavaScript
- **Image Optimization**: Automatic via `next/image`
- **Code Splitting**: Automatic route-based splitting

### Backend Optimizations

- **Compression**: Response compression middleware
- **Caching**: Redis for session/data caching (planned)
- **Connection Pooling**: PostgreSQL connection pool

## Monitoring and Observability

### Health Checks

```bash
# Manual health check
bash deployment/scripts/monitoring/health-check.sh
```

**Checks:**

- Service availability
- Database connectivity
- Resource usage (CPU, memory, disk)
- Certificate expiration

### Logging

- **Development**: Console output
- **Production**: Structured JSON logs with rotation
- **Retention**: 30 days (configurable)

See [deployment/docs/LOG_MANAGEMENT.md](../deployment/docs/LOG_MANAGEMENT.md)

## Future Enhancements

Planned features for v0.2.0 and beyond:

- PostgreSQL replication (master-slave)
- Automated backup system
- Circuit breaker implementation
- Enhanced monitoring and alerting
- Code signing infrastructure
- Comprehensive E2E test suite

See [docs/future/](./future/) for detailed specifications.

## Best Practices Summary

### Do ✅

- Use framework CLIs for code generation
- Import types from `@aria/types`
- Write tests for new features
- Follow the four-agent principles
- Use path aliases for imports
- Keep controllers/components thin
- Centralize shared code in packages

### Don't ❌

- Create files manually that CLIs can generate
- Use `any` type in TypeScript
- Duplicate code across applications
- Commit secrets or credentials
- Skip quality checks before PR
- Mix business logic in controllers/components
- Create app-specific overrides of shared configs

---

**For more details on specific topics:**

- [Getting Started](./getting-started.md) - Setup and first steps
- [Contributing](../CONTRIBUTING.md) - Contribution workflow
- [Development Agents](../AGENTS.md) - Detailed agent guidelines
- [Deployment](./deployment.md) - Production deployment guide
