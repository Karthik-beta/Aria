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

A monorepo (monolithic repository) is a single repository containing multiple applications and packages. Aria uses pnpm workspaces and Turborepo to manage all backend, frontends, and shared code in one place.

**Benefits:**

- Easier code sharing between projects
- Single version control history
- Simplified dependency management
- Coordinated changes across apps

### Why TypeScript?

TypeScript adds type safety to JavaScript:

- **Catch errors early** - Before runtime
- **Better IDE support** - Autocomplete and IntelliSense
- **Self-documenting code** - Types serve as documentation
- **Safer refactoring** - Compiler catches breaking changes

### What technologies does Aria use?

- **Backend**: NestJS (Node.js framework)
- **Frontend**: Next.js 15 with React
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Build Tool**: Turborepo
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (planned)

## Setup & Installation

### Do I need Docker for development?

**No!** Docker is only needed for:

- Production deployment
- Testing the deployment package locally

For regular development, you only need Node.js and pnpm.

### What Node.js version should I use?

Use **Node.js 20 or 22** (LTS versions). Check your version:

```bash
node --version
```

### How do I install pnpm?

pnpm comes with Node.js 16.13+:

```bash
# Enable pnpm
corepack enable pnpm

# Verify
pnpm --version
```

### Do I need to install dependencies in each app?

**No!** Run `pnpm install` once from the root directory. pnpm handles all workspaces automatically.

### How long does installation take?

First install: 2-5 minutes depending on internet speed.  
Subsequent installs: Much faster due to pnpm's caching.

## Development

### How do I start multiple apps at once?

Open multiple terminals:

```bash
# Terminal 1: Backend
pnpm --filter backend start:dev

# Terminal 2: Asset frontend
pnpm --filter asset dev

# Terminal 3: CRM frontend
pnpm --filter crm dev
```

Or use VS Code's split terminals or a terminal multiplexer like `tmux`.

### Which ports do apps use?

Default ports:

- **Backend**: 3000
- **Asset**: 3001
- **CRM**: 3002
- **HRMS**: 3003
- **Inventory**: 3004

Next.js automatically uses the next available port if one is taken.

### Can I run frontend without backend?

Yes, but API calls will fail unless you:

- Mock the API responses
- Use a staging/development backend
- Run the backend separately

### What's the difference between `dev` and `start:dev`?

- **`dev`**: Next.js development command (for frontends)
- **`start:dev`**: NestJS development command (for backend)

Both start the app in development mode with hot reload.

### Do I need to restart after changing shared packages?

**Yes.** Rebuild and restart when changing `@aria/types` or `@aria/utils`:

```bash
# Rebuild the package
pnpm --filter @aria/types build

# Restart your app
pnpm --filter <app-name> dev
```

### How do I generate new code?

Always use framework CLIs:

```bash
# NestJS (backend)
cd apps/backend
pnpm nest g module users
pnpm nest g controller users
pnpm nest g service users

# Next.js follows file-based routing
# Create files directly in apps/frontend/<app>/src/app/
```

## TypeScript

### Why "Cannot find module '@aria/types'"?

The types package hasn't been built:

```bash
pnpm --filter @aria/types build
```

### Where should I define new types?

- **Shared between apps**: `packages/types/src/`
- **App-specific**: Within the app's `src/` directory

### Do I need to annotate every variable?

**No!** TypeScript infers types:

```typescript
// ✅ Inferred - no annotation needed
const name = 'John';

// ✅ Annotate function parameters and returns
function greet(name: string): string {
  return `Hello ${name}`;
}
```

### Interface vs Type - which should I use?

By convention:

- **`interface`** for object shapes
- **`type`** for unions, intersections, primitives

```typescript
// ✅ Interface for objects
interface User {
  name: string;
  age: number;
}

// ✅ Type for unions
type Status = 'active' | 'inactive' | 'pending';
```

### How do I handle optional properties?

Use the `?` operator:

```typescript
interface User {
  name: string; // Required
  email?: string; // Optional
  phone?: string; // Optional
}

// Both valid
const user1: User = { name: 'John' };
const user2: User = { name: 'Jane', email: 'jane@example.com' };
```

## Testing

### Where should I put test files?

- **Unit tests**: Next to source (`UserService.spec.ts`)
- **Integration tests**: In `test/` directory (`apps/backend/test/`)
- **E2E tests**: In `e2e/` directory (planned)

### Do I need tests for every file?

**Priority:**

1. **Business logic** (services, utilities) - Always
2. **API endpoints** - Always
3. **Complex components** - When complex
4. **Simple components** - Optional

### How do I run tests for one file?

```bash
# Backend (Jest)
pnpm --filter backend test -- UserService.spec.ts

# Frontend (Vitest, when configured)
pnpm --filter asset test -- UserCard.test.tsx
```

### Unit tests vs E2E tests?

**Unit tests:**

- Test individual functions/classes
- Fast (milliseconds)
- Mock dependencies
- Run during development

**E2E tests:**

- Test complete workflows
- Slower (seconds)
- Use real or test database
- Run before releases

## Deployment

### How do I deploy Aria ERP?

See the [Deployment Guide](./deployment.md) for complete instructions.

### Can I deploy just one module?

The system is designed as a complete suite, but individual modules can be deployed separately if needed.

### Development vs Production builds?

**Development:**

- Hot reload enabled
- Source maps included
- Not optimized
- Development warnings

**Production:**

- Optimized and minified
- No hot reload
- Smaller file sizes
- Production-ready

### How do I build for production?

```bash
# Build everything
pnpm build

# Build specific app
pnpm --filter backend build
pnpm --filter asset build
```

### How do I manage logs in production?

Aria includes automatic log rotation:

- **Docker logs**: Rotate at 10MB (configurable)
- **Application logs**: Managed by rotation scripts
- **Retention**: 30 days (configurable)
- **Compression**: Enabled by default

See [Log Management Guide](../deployment/docs/LOG_MANAGEMENT.md)

```bash
# Linux
bash deployment/scripts/maintenance/linux/rotate-logs.sh

# Windows
.\deployment\scripts\maintenance\windows\rotate-logs.ps1
```

## Troubleshooting

### TypeScript errors in editor but code runs

Your editor might use a different TypeScript version:

1. Restart your editor
2. Reload window (VS Code: `Ctrl+Shift+P` → "Reload Window")
3. Ensure editor uses workspace TypeScript

### Changes not showing in browser

Try:

1. **Hard refresh**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. **Clear cache**: Clear browser cache
3. **Restart dev server**: Stop and restart the dev command
4. **Delete build folder**: `rm -rf .next` (frontend) or `rm -rf dist` (backend)

### "Port already in use"

**Windows:**

```powershell
netstat -ano | findstr :3000
taskkill /PID <process-id> /F
```

**Linux/Mac:**

```bash
lsof -ti:3000 | xargs kill
```

### pnpm commands are slow

Disable update checks:

```bash
# Add to shell profile
export PNPM_UPDATE_NOTIFIER=false
```

### "Cannot find module" errors everywhere

Reinstall dependencies:

```bash
# Clean install
rm -rf node_modules
pnpm install

# Rebuild shared packages
pnpm --filter @aria/types build
pnpm --filter @aria/utils build
```

### ESLint errors not showing in VS Code

Install the ESLint extension:

1. Open VS Code Extensions (`Ctrl+Shift+X`)
2. Search for "ESLint"
3. Install the official ESLint extension
4. Reload VS Code

### Build fails with "out of memory"

Increase Node.js memory:

```bash
# Temporarily
NODE_OPTIONS="--max-old-space-size=4096" pnpm build

# Or add to package.json
"build": "NODE_OPTIONS=--max-old-space-size=4096 turbo run build"
```

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
pnpm --filter backend start:dev
```

**Frontend (Next.js):**

```bash
# Clear .next folder
rm -rf apps/frontend/<app>/.next
pnpm --filter <app> dev
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
