# Getting Started with Aria ERP

Welcome to Aria ERP! This guide will help you set up your development environment and make your first contribution.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 20 or 22 (LTS recommended) - [Download](https://nodejs.org/)
- **Bun** 1.3.x or later - [Download](https://bun.sh/)
- **Git** - [Download](https://git-scm.com/)
- **Code Editor** - We recommend [VS Code](https://code.visualstudio.com/)
- **Docker** 20.10+ (optional, only for deployment testing)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Karthik-beta/Aria.git
cd Aria
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies (takes 2-5 minutes first time)
bun install
```

### 3. Configure Environment Variables

Ensure `apps/backend/.env` exists with these variables:

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:password123@localhost:5432/Aria

# Default Admin User
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_ADMIN_EMAIL=admin@aria.local
DEFAULT_ADMIN_NAME=Administrator

# JWT & Auth
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
BETTER_AUTH_SECRET=dev_better_auth_secret_change_in_production

# CORS & Frontend
FRONTEND_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3001
```

### 4. Start PostgreSQL

**Option A: Docker (Recommended)**

```bash
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=password123 \
  -e POSTGRES_DB=Aria \
  -p 5432:5432 \
  postgres:latest
```

**Option B: Local PostgreSQL**

Ensure it's running and accessible:

```bash
psql -U postgres -d postgres -c "SELECT 1"
```

### 5. Start Development Servers

Choose what you want to work on:

```bash
# Start the backend API (NestJS)
bun --filter backend start:dev

# Start a frontend application (Next.js)
bun --filter frontend dev    # All modules (Asset, CRM, HRMS, Inventory)
```

**Default Ports:**

- Backend API: `http://localhost:3001`
- Frontend: `http://localhost:3000`

### 6. Access Admin Dashboard

1. Navigate to `http://localhost:3000`
2. Sign in with:
   - **Username**: `admin`
   - **Password**: `admin123`
3. Go to `/admin` to access the admin dashboard

## Understanding the Monorepo

Aria ERP uses a **monorepo** structure - one repository containing multiple applications and shared packages:

```
Aria/
├── apps/
│   ├── backend/              # NestJS API server (Node.js)
│   └── frontend/             # Next.js web applications
│       ├── asset/            # Asset management module
│       ├── CRM/              # Customer relations module
│       ├── hrms/             # Human resources module
│       └── inventory/        # Inventory management module
├── packages/
│   ├── types/                # Shared TypeScript definitions
│   ├── utils/                # Shared utility functions
│   ├── config-eslint/        # ESLint configuration
│   └── config-typescript/    # TypeScript configuration
├── deployment/               # Production deployment toolkit
└── docs/                     # Documentation
```

### Key Concepts

- **Backend** (`apps/backend/`) - NestJS API server handling business logic and database operations
- **Frontends** (`apps/frontend/*`) - Next.js applications providing user interfaces
- **Shared Packages** (`packages/*`) - Reusable code shared across applications
- **Monorepo Management** - bun workspaces + Turborepo for efficient builds and caching

## Common Development Tasks

### Running Quality Checks

```bash
# Format all code (Prettier)
bun format

# Lint all code (ESLint)
bun run lint

# Run all tests
bun run test

# Run all type checks
bun run typecheck

# Build all applications
bun run build
```

### Working with Shared Packages

When you modify shared packages, rebuild them:

```bash
# Rebuild types package
bun --filter @aria/types build

# Rebuild utils package
bun --filter @aria/utils build
```

### Creating New Code

Always use framework CLI generators:

```bash
# Generate NestJS resources
cd apps/backend
bun nest g module users
bun nest g controller users
bun nest g service users

# Next.js follows file-based routing
# Create files directly in apps/frontend/src/app/
```

```

```
