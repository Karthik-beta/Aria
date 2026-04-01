# Frequently Asked Questions

Common questions and solutions for developing with Aria ERP.

## Table of Contents

- [General](#general)
- [Setup & Installation](#setup--installation)
- [Development](#development)
- [TypeScript](#typescript)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## General

### What is Aria ERP?

Aria ERP is a modern, modular enterprise resource planning system built for B2B businesses. It includes modules for asset management, CRM, human resources, and inventory management.

### What is a monorepo?

A monorepo (monolithic repository) is a single repository containing multiple applications and packages. Aria uses Bun workspaces and Turborepo to manage the backend, frontend, and shared code in one place.

**Benefits:**

- Easier code sharing between projects
- Single version control history
- Simplified dependency management
- Coordinated changes across apps

### What technologies does Aria use?

| Layer | Technology |
|-------|------------|
| Backend | NestJS 11 (Node.js framework) |
| API | tRPC (type-safe RPC) |
| Database | PostgreSQL with Prisma 7 ORM |
| Authentication | better-auth |
| Frontend | Next.js (App Router) with React |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui + Radix UI |
| Package Manager | Bun |
| Build Tool | Turborepo |
| Linting/Formatting | Biome |
| Testing | Jest (backend), Vitest (frontend), Playwright (E2E) |

## Setup & Installation

### Do I need Docker for development?

**No!** Docker is only needed for:

- Production deployment
- Running PostgreSQL (if you don't have a local install)

For regular development, you need Node.js, Bun, and PostgreSQL.

### What Node.js version should I use?

Use **Node.js 20 or 22** (LTS versions). Check your version:

```bash
node --version
```

### How do I install Bun?

Install Bun from [bun.sh](https://bun.sh/):

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Verify
bun --version
```

### Do I need to install dependencies in each app?

**No!** Run `bun install` once from the root directory. Bun handles all workspaces automatically.

## Development

### How do I start the development servers?

Open two terminals:

```bash
# Terminal 1: Backend (port 3001)
bun --filter backend start:dev

# Terminal 2: Frontend (port 3000)
bun --filter frontend dev
```

### Which ports do apps use?

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 3001 | http://localhost:3001 |

The frontend is a single Next.js application. Different modules are accessed via route paths: `/asset`, `/crm`, `/hrms`, `/inventory`, `/admin`.

### Can I run the frontend without the backend?

Yes, but tRPC API calls will fail unless you mock them or point to a remote backend.

### What's the difference between `dev` and `start:dev`?

- **`dev`**: Next.js development command (for the frontend)
- **`start:dev`**: NestJS development command (for the backend)

Both start the app in development mode with hot reload.

### Do I need to rebuild shared packages after changes?

**No.** Shared packages use the **JIT (Just-in-Time) pattern** — they export source TypeScript directly. Changes reflect immediately without rebuilding.

### How do I run database migrations?

```bash
cd apps/backend

# Create and apply a new migration
bun x --bun prisma migrate dev --name your_migration_name

# Apply existing migrations (production)
bun x --bun prisma migrate deploy
```

### How do I load demo data?

```bash
cd apps/backend

# Seed authorization (roles, permissions, apps)
bun x tsx prisma/seed-authorization.ts

# Load inventory demo data
bun prisma/demo-data/cli.ts load --scale=medium
```

## TypeScript

### Where should I define new types?

- **Shared between apps**: `packages/types/src/`
- **tRPC contract types**: `packages/api-contract/src/`
- **App-specific**: Within the app's `src/` directory

### Interface vs Type — which should I use?

By convention:

- **`interface`** for object shapes
- **`type`** for unions, intersections, primitives

```typescript
// Interface for objects
interface User {
  name: string;
  age: number;
}

// Type for unions
type Status = 'active' | 'inactive' | 'pending';
```

## Testing

### Where should I put test files?

- **Unit tests**: Next to source with `.spec.ts` suffix (backend) or `.test.ts` suffix (frontend)
- **Integration tests**: In `apps/backend/test/`
- **E2E tests**: In `apps/frontend/e2e/`

### How do I run tests?

```bash
# All tests via Turbo
bun run test

# Backend tests only (Jest)
bun --filter backend test

# Frontend unit tests only (Vitest)
bun --filter frontend test

# E2E tests (Playwright)
bun run test:e2e
```

## Deployment

### How do I deploy Aria ERP?

See the [Deployment Guide](../../docs/05-deployment/README.md) for complete instructions. In short:

```bash
docker compose -f docker-compose.production.yml up -d --build
```

### How do I build for production?

```bash
# Build everything
bun run build

# Build specific app
bun --filter backend build
bun --filter frontend build
```

## Troubleshooting

### TypeScript errors in editor but code runs

1. Restart your editor
2. Reload window (VS Code: `Ctrl+Shift+P` → "Reload Window")
3. Ensure editor uses workspace TypeScript

### Changes not showing in browser

1. **Hard refresh**: `Ctrl+Shift+R`
2. **Clear cache**: Clear browser cache
3. **Restart dev server**: Stop and restart the dev command
4. **Delete build folder**: `rm -rf apps/frontend/.next` or `rm -rf apps/backend/dist`

### "Port already in use"

```bash
# Linux/Mac
lsof -ti:3001 | xargs kill

# Windows
netstat -ano | findstr :3001
taskkill /PID <process-id> /F
```

### "Cannot find module" errors

Reinstall dependencies:

```bash
rm -rf node_modules
bun install
```

### Biome lint errors not showing in VS Code

Install the Biome extension:

1. Open VS Code Extensions (`Ctrl+Shift+X`)
2. Search for "Biome"
3. Install the official Biome extension
4. Reload VS Code

### Git shows too many changed files

Configure line endings:

**Windows:**

```bash
git config --global core.autocrlf true
```

**Linux/Mac:**

```bash
git config --global core.autocrlf input
```

### Hot reload not working

**Backend (NestJS):**

```bash
# Ensure you're using start:dev, not start
bun --filter backend start:dev
```

**Frontend (Next.js):**

```bash
# Clear .next folder
rm -rf apps/frontend/.next
bun --filter frontend dev
```

### Tests fail on CI but pass locally

**Common causes:**

- Different Node.js versions
- Missing environment variables
- Timing issues in tests
- Different file paths (Windows vs Linux)

**Solutions:**

- Match Node.js version with CI
- Check CI logs for specific errors
- Add proper test timeouts
- Use cross-platform path utilities

### Docker issues during deployment

See [Deployment Troubleshooting](../deployment/docs/TROUBLESHOOTING.md) for:

- Container startup failures
- Network connectivity issues
- Volume permission problems
- SSL certificate errors

## Still Need Help?

### Documentation

- [Getting Started Guide](./getting-started.md)
- [Architecture Guide](./architecture.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Deployment Guide](./deployment.md)

### External Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [pnpm Documentation](https://pnpm.io/)

### Get Support

1. **Search GitHub Issues** - Someone may have had the same problem
2. **Check deployment docs** - [deployment/docs/TROUBLESHOOTING.md](../deployment/docs/TROUBLESHOOTING.md)
3. **Open an issue** - Create a GitHub issue with details
4. **Review code examples** - Look at existing code in the repository

---

**💡 Tip**: Bookmark this FAQ for quick reference during development!
