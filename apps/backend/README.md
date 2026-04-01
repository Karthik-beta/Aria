# 🔧 Backend API Service

The **Backend** is the heart of the Aria ERP system. It's built with **NestJS**, a powerful Node.js framework that makes building server applications easy and organized.

## 📋 What Does This Do?

This backend service:

- Handles all business logic (calculations, data processing)
- Manages the database (stores and retrieves data)
- Provides secure APIs that frontends can call
- Enforces authentication and authorization rules

Think of it as a restaurant kitchen—the frontends take orders, but the backend does all the cooking!

## 🚀 Quick Start

### First Time Setup

```bash
# 1. Install all dependencies (run from project root)
bun install

# 2. Start the development server
bun --filter backend start:dev
```

The server will start at `http://localhost:3000` with hot-reload enabled (changes apply automatically).

### Common Commands

| What You Want To Do  | Command                          | What Happens                              |
| -------------------- | -------------------------------- | ----------------------------------------- |
| Start the server     | `bun --filter backend start:dev` | Runs in development mode with auto-reload |
| Build for production | `bun --filter backend build`     | Creates optimized production files        |
| Run tests            | `bun --filter backend test`      | Runs all unit tests                       |
| Run end-to-end tests | `bun --filter backend test:e2e`  | Tests complete workflows                  |
| Check code style     | `bun --filter backend lint`      | Finds and fixes code formatting issues    |
| See test coverage    | `bun --filter backend test:cov`  | Shows how much code is tested             |

## 📦 Standard UOM Seed Data

- Canonical file path: `apps/backend/prisma/seeds/data/uom.csv`
- Behavior: backend startup preloads missing Unit of Measure rows from this CSV.
- Safety: preload is idempotent and **insert-only** by case-insensitive name. Existing rows are not updated or deleted.
- Update workflow: edit `uom.csv`, keep headers as `"UOM Name","Enabled","Must be Whole Number"`, and restart backend to preload newly added names.

## 📦 Demo Data Loader

- Canonical file path: `apps/backend/prisma/demo-data/README.md`
- Load the inventory demo dataset:
  `bun prisma/demo-data/cli.ts load --scale=medium`
- Inspect the demo dataset:
  `bun prisma/demo-data/cli.ts status`
- Remove the demo dataset:
  `bun prisma/demo-data/cli.ts clean`

This loader creates the Pivotr Electronics sample inventory story used for
demos, QA, and training.

## 📁 Project Structure

```
apps/backend/
├── src/
│   ├── main.ts                    # Application entry point (starts here!)
│   ├── app.module.ts              # Root module (connects everything)
│   ├── modules/                   # Feature modules
│   │   ├── auth/                  # User authentication
│   │   ├── assets/                # Asset management
│   │   ├── crm/                   # Customer relationships
│   │   ├── hrms/                  # Human resources
│   │   └── inventory/             # Stock management
│   └── common/                    # Shared utilities
│       ├── guards/                # Security checks
│       ├── pipes/                 # Data validation
│       └── interceptors/          # Request/response handling
└── test/                          # End-to-end test files
```

### Understanding the Structure

- **`modules/`**: Each business domain (CRM, HR, etc.) has its own folder with controllers, services, and tests
- **`common/`**: Code that's used across multiple modules (like authentication checks)
- **`main.ts`**: The starting point—this file boots up the entire application

## 🛠️ Adding New Features

### Creating a New Module

NestJS provides CLI commands to generate code automatically:

```bash
# Navigate to backend directory
cd apps/backend

# Generate a new module (e.g., "reports")
bun nest g module reports

# Generate a controller (handles HTTP requests)
bun nest g controller reports

# Generate a service (handles business logic)
bun nest g service reports
```

This creates all necessary files with proper structure!

### Best Practices

1. **Keep controllers thin**: Controllers should just receive requests and pass them to services
2. **Put logic in services**: All business logic, calculations, and data operations go in services
3. **Write tests**: Create a `.spec.ts` file next to your code with test cases
4. **Use shared types**: Import types from `@aria/types` instead of creating new ones

## 🧪 Testing Guide

### Unit Tests

Unit tests check individual functions in isolation:

```bash
# Run all tests
bun --filter backend test

# Run tests in watch mode (re-runs on changes)
bun --filter backend test:watch

# Run tests with coverage report
bun --filter backend test:cov
```

### End-to-End (E2E) Tests

E2E tests exercise the HTTP and authorization surface without requiring the full production stack:

```bash
bun --filter backend test:e2e
```

**Test files**: Place unit tests next to the code as `*.spec.ts`, and E2E tests in the `test/` folder with the `.e2e-spec.ts` suffix.

## 🔒 Type Safety & Shared Code

### Using Shared Types

Always import types from the shared package:

```typescript
// ✅ Good: Import from shared package
import { Asset, User } from '@aria/types';

// ❌ Bad: Creating types locally
interface Asset {
  /* ... */
}
```

### Using Shared Utilities

```typescript
// Import pure helper functions
import { formatCurrency, calculateTotal } from '@aria/utils';
```

This ensures consistency across the entire application!

## 🐛 Debugging Tips

### Server Won't Start?

1. **Check if port 3000 is already in use**:

   ```bash
   # Windows
   netstat -ano | findstr :3000

   # Linux/Mac
   lsof -i :3000
   ```

2. **Make sure dependencies are installed**:

   ```bash
   bun install
   ```

3. **Check for TypeScript errors**:
   ```bash
   bun --filter backend exec tsc --noEmit
   ```

### Tests Failing?

- Check that you've mocked external dependencies
- Look at the error message—it usually tells you what's wrong!

## 📚 Learning Resources

### New to NestJS?

- [Official NestJS Documentation](https://docs.nestjs.com/) - Comprehensive guides
- [NestJS Fundamentals](https://docs.nestjs.com/first-steps) - Start here if you're brand new
- [Controllers](https://docs.nestjs.com/controllers) - How to handle HTTP requests
- [Providers/Services](https://docs.nestjs.com/providers) - Where business logic lives

### New to Testing?

- [Jest Documentation](https://jestjs.io/docs/getting-started) - Test runner used by backend E2E specs
- [Supertest Documentation](https://github.com/ladjs/supertest) - HTTP assertion library used by backend E2E specs
- [Testing NestJS Applications](https://docs.nestjs.com/fundamentals/testing) - NestJS-specific testing guide

## 🎯 Development Workflow

1. **Create a new branch** for your feature
2. **Generate modules/controllers/services** using NestJS CLI
3. **Write your code** following the structure
4. **Add tests** for your new functionality
5. **Run lint and tests** before committing:
   ```bash
   bun --filter backend lint
   bun --filter backend test
   ```
6. **Build to verify everything works**:
   ```bash
   bun --filter backend build
   ```

## 💡 Pro Tips

- **Use the CLI**: Let NestJS generate boilerplate code for you
- **Keep it modular**: Each feature should be in its own module
- **Test as you go**: Don't wait until the end to write tests
- **Check the logs**: When something breaks, the console usually tells you why
- **Ask for help**: Review the `AGENTS.md` file for architectural guidance

## 🔗 Related Documentation

- [Aria Project Overview](../../README.md) - Main project documentation
- [Shared Type Definitions](../../packages/types/README.md) - TypeScript types used across the app
- [Development Agents](../../AGENTS.md) - Architectural principles and best practices
- [Security Guidelines](../../SECURITY.md) - Security policies

---

**Questions?** Check out the [NestJS Discord](https://discord.gg/nestjs) or review existing code in the `modules/` directory for examples!
