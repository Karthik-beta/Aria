# ❓ Frequently Asked Questions (FAQ)

Common questions and answers about developing with Aria ERP.

## 📚 Table of Contents

- [General Questions](#general-questions)
- [Setup & Installation](#setup--installation)
- [Development](#development)
- [TypeScript & Types](#typescript--types)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## 🌐 General Questions

### What is Aria ERP?

Aria ERP is a modern, modular enterprise resource planning system built for B2B businesses. It includes modules for asset management, CRM, human resources, and inventory management.

### What is a monorepo?

A monorepo (monolithic repository) is a single repository that contains multiple applications and packages. Instead of having separate repositories for backend, each frontend, and shared code, everything lives in one place.

**Benefits**:
- Easier to share code between projects
- Single version control history
- Simplified dependency management
- Coordinated changes across multiple apps

### Why TypeScript?

TypeScript adds type safety to JavaScript, which means:
- **Catch errors early** - Before runtime
- **Better autocomplete** - Your editor knows what's available
- **Self-documenting code** - Types serve as documentation
- **Safer refactoring** - The compiler catches breaking changes

### What are the main technologies used?

- **Backend**: NestJS (Node.js framework)
- **Frontend**: Next.js 15 with React
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Build Tool**: Turborepo
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (planned)

## 🔧 Setup & Installation

### Do I need to install Docker for development?

**No!** Docker is only needed for:
- Deployment
- Running the production setup locally

For regular development, you only need Node.js and pnpm.

### What Node.js version should I use?

Use **Node.js 20 or 22** (LTS versions). You can check your version with:

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

### Do I need to install dependencies in each app separately?

**No!** Just run `pnpm install` once from the root directory. pnpm handles all workspaces automatically.

### How long does the first install take?

Usually 2-5 minutes depending on your internet connection. Subsequent installs are much faster due to pnpm's caching.

## 💻 Development

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

Or use a terminal multiplexer like `tmux` or VS Code's split terminals.

### Can I run just the frontend without the backend?

Yes, but API calls will fail unless you:
- Mock the API responses
- Use a staging/development backend
- Run the backend separately

### How do I know which port each app uses?

Default ports:
- **Backend**: 3000
- **Asset**: 3001
- **CRM**: 3002
- **HRMS**: 3003
- **Inventory**: 3004

Next.js automatically finds the next available port if one is in use.

### What's the difference between `dev` and `start:dev`?

- **`dev`**: Next.js development command (for frontends)
- **`start:dev`**: NestJS development command (for backend)

They both do the same thing - start the app in development mode with hot reload.

### Do I need to restart after changing shared packages?

**Types** (`@aria/types`): Yes, rebuild and restart
```bash
pnpm --filter @aria/types build
# Then restart your app
```

**Utils** (`@aria/utils`): Yes, rebuild and restart
```bash
pnpm --filter @aria/utils build
# Then restart your app
```

**Config packages**: Usually yes, restart your app

## 📝 TypeScript & Types

### Why do I see "Cannot find module '@aria/types'" error?

The types package hasn't been built yet:

```bash
pnpm --filter @aria/types build
```

### Where should I define new types?

**Shared between apps**: `packages/types/src/`
**App-specific**: Within the app's `src/` directory

### Do I need to annotate every variable?

**No!** TypeScript can infer types:

```typescript
// ✅ TypeScript infers this is a string
const name = 'John';

// ❌ Unnecessary annotation
const name: string = 'John';

// ✅ But DO annotate function parameters and returns
function greet(name: string): string {
  return `Hello ${name}`;
}
```

### What's the difference between `interface` and `type`?

Both work similarly, but by convention:
- Use **`interface`** for object shapes
- Use **`type`** for unions, intersections, and primitives

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
  name: string;        // Required
  email?: string;      // Optional
  phone?: string;      // Optional
}

// Valid
const user: User = { name: 'John' };
const user2: User = { name: 'Jane', email: 'jane@example.com' };
```

## 🧪 Testing

### Where should I put test files?

**Unit tests**: Next to the code they test
```
UserService.ts
UserService.spec.ts
```

**Integration tests**: In `test/` directory
```
apps/backend/test/users.e2e-spec.ts
```

**E2E tests**: In app's `e2e/` directory (planned)
```
apps/frontend/asset/e2e/login.spec.ts
```

### Do I need to write tests for every file?

**Priority**:
1. **Business logic** (services, utilities) - Always test
2. **API endpoints** - Always test
3. **Components with logic** - Test when complex
4. **Simple components** - Optional

### How do I run tests for just one file?

```bash
# NestJS (Jest)
pnpm --filter backend test -- UserService.spec.ts

# Next.js (Vitest, when configured)
pnpm --filter asset test -- UserCard.test.tsx
```

### What's the difference between unit and E2E tests?

**Unit tests**:
- Test individual functions/classes in isolation
- Fast (milliseconds)
- Mock dependencies
- Run frequently during development

**E2E (End-to-End) tests**:
- Test complete workflows
- Slower (seconds)
- Use real or test database
- Run before releases

## 🚀 Deployment

### How do I deploy Aria ERP?

See the [Deployment Guide](./deployment/README.md) for complete instructions.

### Can I deploy just one app?

The system is designed to work as a complete suite, but individual apps can be deployed separately if needed.

### What's the difference between development and production builds?

**Development**:
- Hot reload enabled
- Source maps included
- Not optimized
- Development warnings shown

**Production**:
- Optimized and minified
- No hot reload
- Smaller file sizes
- Production-ready

### How do I build for production?

```bash
# Build everything
pnpm build

# Or build specific apps
pnpm --filter backend build
pnpm --filter asset build
```

## 🔥 Troubleshooting

### My editor shows TypeScript errors but the code runs fine

Your editor might be using a different TypeScript version. Try:

1. Restart your editor
2. Reload the window (VS Code: `Ctrl+Shift+P` → "Reload Window")
3. Check your editor is using the workspace TypeScript version

### Changes aren't showing up in the browser

Try:

1. **Hard refresh**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. **Clear cache**: Clear browser cache
3. **Restart dev server**: Stop and restart `pnpm --filter <app> dev`
4. **Delete `.next` folder**: `rm -rf apps/frontend/<app>/.next`

### "Port already in use" error

Find and kill the process using that port:

**Windows**:
```bash
netstat -ano | findstr :3000
taskkill /PID <process-id> /F
```

**Linux/Mac**:
```bash
lsof -ti:3000 | xargs kill
```

### pnpm commands are slow

pnpm might be checking for updates. Disable update checks:

```bash
# Add to your shell profile
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

### ESLint shows errors but I can't see them in VS Code

Install the ESLint extension:

1. Open VS Code Extensions (`Ctrl+Shift+X`)
2. Search for "ESLint"
3. Install the official ESLint extension
4. Reload VS Code

### Build fails with "out of memory" error

Increase Node.js memory:

```bash
# Temporarily
NODE_OPTIONS="--max-old-space-size=4096" pnpm build

# Or add to package.json scripts
"build": "NODE_OPTIONS=--max-old-space-size=4096 turbo run build"
```

### Git shows too many changed files

You might have line ending issues. Configure git:

```bash
# Configure line endings
git config core.autocrlf true    # Windows
git config core.autocrlf input   # Mac/Linux
```

## 🔗 Additional Help

### Where else can I find help?

- [Getting Started Guide](./GETTING_STARTED.md) - First-time setup
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute
- [Troubleshooting Guide](./deployment/docs/TROUBLESHOOTING.md) - Deployment issues
- App-specific READMEs - Check each app's directory

### How do I ask a good question?

A good question includes:

1. **What you're trying to do**
2. **What you expected to happen**
3. **What actually happened**
4. **Steps to reproduce**
5. **Error messages** (full text, not screenshots if possible)
6. **Your environment** (OS, Node version, etc.)

**Example**:

```
I'm trying to start the backend, but I get an error.

Expected: Backend starts on port 3000
Actual: Get "address already in use" error

Steps:
1. Run `pnpm --filter backend start:dev`
2. See error

Error:
Error: listen EADDRINUSE: address already in use :::3000

Environment:
- OS: Windows 11
- Node: 20.10.0
- pnpm: 8.10.0
```

---

**Still have questions?** Open an issue with your question - we're here to help!
