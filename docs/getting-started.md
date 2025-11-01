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

### 3. Start Development Servers

Choose what you want to work on:

```bash
# Start the backend API (NestJS)
bun --filter backend start:dev

# Start a frontend application (Next.js)
bun --filter frontend dev    # All modules (Asset, CRM, HRMS, Inventory)
```

**Default Ports:**

- Backend API: `http://localhost:3000`
- Asset: `http://localhost:3001`
- CRM: `http://localhost:3002`
- HRMS: `http://localhost:3003`
- Inventory: `http://localhost:3004`

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
bun lint

# Run all tests
bun test

# Build all applications
bun build
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

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

**Branch naming conventions:**

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring

### 2. Make Changes

Follow our [Architecture Guide](./architecture.md) and [Contributing Guide](../CONTRIBUTING.md).

### 3. Test Your Changes

```bash
# Run quality gates (all must pass)
bun format
bun lint
bun test
bun build
```

### 4. Commit and Push

```bash
git add .
git commit -m "feat: add user authentication"
git push origin feature/your-feature-name
```

**Commit message format:**

```
<type>: <description>

Types: feat, fix, docs, style, refactor, test, chore
```

### 5. Create Pull Request

Open a PR on GitHub and fill out the template.

## Development Tips

### Hot Reload

Both backend and frontend support hot reload:

- **Backend**: Automatically restarts on file changes
- **Frontend**: Browser refreshes automatically

### VS Code Extensions

Recommended extensions for optimal development experience:

- **ESLint** - Real-time linting
- **Prettier** - Code formatting
- **TypeScript Vue Plugin** - Enhanced TypeScript support
- **Tailwind CSS IntelliSense** - Tailwind autocomplete

### TypeScript Tips

```typescript
// ✅ Import shared types
import { User, Product } from '@aria/types';

// ✅ Import utilities
import { formatCurrency } from '@aria/utils';

// ✅ Let TypeScript infer types when obvious
const name = 'John'; // TypeScript knows it's a string

// ✅ Annotate function parameters and returns
function greet(name: string): string {
  return `Hello ${name}`;
}
```

## Troubleshooting

### Cannot find module '@aria/types'

Build the shared packages:

```bash
bun --filter @aria/types build
bun --filter @aria/utils build
```

### Port already in use

**Windows:**

```powershell
netstat -ano | findstr :3000
taskkill /PID <process-id> /F
```

**Linux/Mac:**

```bash
lsof -ti:3000 | xargs kill
```

### Changes not showing up

```bash
# Clear cache and rebuild
rm -rf node_modules .next dist
bun install
bun --filter <app-name> dev
```

### TypeScript errors everywhere

```bash
# Rebuild workspace
bun build

# Check for type errors
bun --filter <app-name> exec tsc --noEmit
```

### Dependency installation fails

```bash
# Clear Bun cache (if needed)
rm -rf node_modules

# Clean install
bun install
```

## Next Steps

Now that you're set up:

1. **Explore the codebase** - Look at existing modules and components
2. **Read the architecture** - Understand the [system design](./architecture.md)
3. **Pick an issue** - Find a `good-first-issue` on GitHub
4. **Review contribution guidelines** - See [CONTRIBUTING.md](../CONTRIBUTING.md)
5. **Join discussions** - Participate in GitHub issues and discussions

## Learning Resources

### Project-Specific

- [Architecture Guide](./architecture.md) - System design and patterns
- [Development Agents](../AGENTS.md) - Development philosophy
- [FAQ](./faq.md) - Common questions and solutions

### External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/) - Learn TypeScript
- [NestJS Documentation](https://docs.nestjs.com/) - Backend framework
- [Next.js Documentation](https://nextjs.org/docs) - Frontend framework
- [Bun Documentation](https://bun.sh/docs) - Package manager documentation

## Getting Help

- **Documentation** - Check [docs/README.md](./README.md) for all guides
- **FAQ** - See [FAQ](./faq.md) for common issues
- **GitHub Issues** - Search existing issues or create a new one
- **Code Examples** - Review existing code in the repository

---

**Welcome aboard! 🚀**

We're excited to have you contributing to Aria ERP. Don't hesitate to ask questions!
