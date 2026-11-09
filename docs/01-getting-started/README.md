# Getting Started with Aria ERP

Welcome to Aria ERP! This guide will help you set up your development environment and start contributing.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20 or 22 (LTS recommended) — [Download](https://nodejs.org/)
- **Bun** 1.3.x or later — [Download](https://bun.sh/)
- **Git** — [Download](https://git-scm.com/)
- **PostgreSQL** 16+ — [Download](https://www.postgresql.org/) (or use Docker)
- **Code Editor** — We recommend [VS Code](https://code.visualstudio.com/)
- **Docker** 20.10+ (optional, only for deployment testing)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Karthik-beta/Aria.git
cd Aria
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
bun install
```

### 3. Configure Environment Variables

Create `apps/backend/.env` with these variables:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password123@localhost:5432/Aria

# Default Admin User
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_ADMIN_EMAIL=admin@aria.local
DEFAULT_ADMIN_NAME=Administrator

# Auth
BETTER_AUTH_SECRET=dev_better_auth_secret_change_in_production

# CORS & Frontend
FRONTEND_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3001
```

Create `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Start PostgreSQL

**Option A: Docker (Recommended)**

```bash
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=password123 \
  -e POSTGRES_DB=Aria \
  -p 5432:5432 \
  postgres:18-alpine
```

**Option B: Local PostgreSQL**

Ensure it's running and accessible:

```bash
psql -U postgres -d postgres -c "SELECT 1"
```

### 5. Set Up the Database

```bash
cd apps/backend

# Run migrations
bun x --bun prisma migrate dev

# Seed authorization data (roles, permissions, default apps)
# (Removed — better-auth admin plugin handles role seeding on startup)

# Load inventory demo data (optional)
bun prisma/demo-data/cli.ts load --scale=medium

# Return to root
cd ../..
```

### 6. Start Development Servers

```bash
# Terminal 1: Start the backend API (NestJS on port 3001)
bun --filter backend start:dev

# Terminal 2: Start the frontend (Next.js on port 3000)
bun --filter frontend dev
```

### 7. Access the Application

1. Navigate to `http://localhost:3000`
2. Sign in with:
   - **Username**: `admin`
   - **Password**: `admin123`
3. Go to `/admin` to access the admin dashboard
4. Go to `/inventory` to access the Inventory module

## Understanding the Monorepo

Aria ERP uses a **monorepo** structure — one repository containing multiple applications and shared packages:

```
Aria/
├── apps/
│   ├── backend/              # NestJS API server
│   │   ├── src/
│   │   │   ├── apps/         # Feature modules (inventory, etc.)
│   │   │   ├── auth/         # better-auth integration
│   │   │   ├── trpc/         # tRPC router assembly
│   │   │   ├── shared/       # Shared services (Prisma, etc.)
│   │   │   └── generated/    # Prisma-generated client
│   │   └── prisma/           # Schema, migrations, seeds, demo data
│   └── frontend/             # Next.js App Router
│       └── src/app/
│           ├── admin/        # Admin console (users, roles, audit)
│           ├── asset/        # Asset management module
│           ├── crm/          # Customer relations module
│           ├── hrms/         # Human resources module
│           └── inventory/    # Inventory management module
├── packages/
│   ├── api-contract/         # Type-only tRPC contract layer
│   ├── types/                # Shared TypeScript definitions
│   ├── utils/                # Shared utility functions
│   └── config-typescript/    # TypeScript configuration presets
├── deployment/               # Docker Compose, Caddy, monitoring
└── docs/                     # Documentation
```

### Key Concepts

- **Backend** (`apps/backend/`) — NestJS API server exposing tRPC endpoints, with Prisma 7 for database access and better-auth for authentication
- **Frontend** (`apps/frontend/`) — Single Next.js application using App Router with route groups for each ERP module
- **API Contract** (`packages/api-contract/`) — Type-only package ensuring frontend↔backend type safety via tRPC
- **Shared Packages** (`packages/*`) — Reusable types, utilities, and TypeScript configs shared across applications
- **Monorepo Management** — Bun workspaces + Turborepo for efficient builds and caching

## Common Development Tasks

### Running Quality Checks

```bash
# Format all code (Biome)
bun format

# Lint all code (Biome via Turbo)
bun run lint

# Run all tests
bun run test

# Run all type checks
bun run typecheck

# Build all applications
bun run build

# Run all validations at once
bun run validate
```

### Database Commands

```bash
cd apps/backend

# Create a new migration after schema changes
bun x --bun prisma migrate dev --name your_migration_name

# Generate Prisma client (after schema changes)
bun x --bun prisma generate

# Reset database (WARNING: deletes all data)
bun x --bun prisma migrate reset

# Load inventory demo data
bun prisma/demo-data/cli.ts load --scale=medium
```

### Working with Shared Packages

Shared packages use the **JIT (Just-in-Time) pattern** — they export source TypeScript files directly, so **no build step is required**. Changes to shared packages reflect immediately in consuming apps.

```bash
# Type-check a shared package
bun --filter @aria/types check-types
```
