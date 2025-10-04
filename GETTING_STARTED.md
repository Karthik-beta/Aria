# 🚀 Getting Started with Aria ERP

Welcome to Aria ERP! This guide will help you get up and running quickly, whether you're new to development or experienced with monorepos.

## 📋 What You'll Need

Before starting, make sure you have:

- **Node.js** version 20 or 22 ([Download here](https://nodejs.org/))
- **pnpm** package manager (we'll install this)
- **Git** for version control ([Download here](https://git-scm.com/))
- **A code editor** - We recommend [Visual Studio Code](https://code.visualstudio.com/)
- **Docker** (only needed for deployment, not for development)

## ⏱️ Quick Start (5 Minutes)

### Step 1: Clone the Repository

```bash
# Clone the project
git clone <repository-url>
cd Aria

# Or if you already have it:
cd Aria
```

### Step 2: Enable pnpm

```bash
# Enable pnpm (comes with Node.js 16.13+)
corepack enable pnpm

# Verify pnpm is installed
pnpm --version
```

### Step 3: Install Dependencies

```bash
# Install all dependencies for the entire project
# This might take a few minutes the first time
pnpm install
```

### Step 4: Start Developing!

Pick what you want to work on:

```bash
# Start the backend API
pnpm --filter backend start:dev

# Or start a frontend app
pnpm --filter asset dev      # Asset Management
pnpm --filter crm dev        # Customer Relations
pnpm --filter hrms dev       # Human Resources
pnpm --filter inventory dev  # Inventory Management
```

That's it! 🎉

## 📚 Understanding the Project Structure

Aria ERP is organized as a **monorepo** - one repository containing multiple applications:

```
Aria/
├── apps/                          # All applications
│   ├── backend/                   # NestJS API server
│   └── frontend/                  # Next.js web apps
│       ├── asset/                 # Asset management
│       ├── CRM/                   # Customer relations
│       ├── hrms/                  # Human resources
│       └── inventory/             # Inventory management
│
├── packages/                      # Shared code
│   ├── types/                     # TypeScript types (shared definitions)
│   ├── utils/                     # Utility functions (shared helpers)
│   ├── config-eslint/             # Code style rules
│   └── config-typescript/         # TypeScript settings
│
├── deployment/                    # Deployment tools
└── traefik/                       # Reverse proxy configuration
```

### What Does Each Part Do?

- **`apps/backend/`**: The API server that handles all business logic and database operations
- **`apps/frontend/*`**: Web applications that users interact with
- **`packages/types/`**: Shared TypeScript definitions so frontend and backend speak the same language
- **`packages/utils/`**: Helper functions used across all apps (like formatting dates, calculating totals)
- **`packages/config-*`**: Configuration shared across all apps for consistency

## 🎯 Your First Task

Let's make a small change to see how everything works!

### Option 1: Backend Change

1. Open `apps/backend/src/app.controller.ts`
2. Find the `getHello()` function
3. Change the return message
4. Save the file
5. The server automatically reloads - check http://localhost:3000

### Option 2: Frontend Change

1. Start the asset app: `pnpm --filter asset dev`
2. Open `apps/frontend/asset/src/app/page.tsx`
3. Change some text
4. Save the file
5. The browser automatically refreshes!

## 🛠️ Common Commands

### Development

```bash
# Start a specific app in development mode
pnpm --filter <app-name> dev

# Examples:
pnpm --filter backend start:dev
pnpm --filter asset dev
pnpm --filter crm dev
```

### Quality Checks

```bash
# Format all code
pnpm format

# Check code style (lint)
pnpm lint

# Run tests
pnpm test

# Build everything
pnpm build
```

### Building Shared Packages

```bash
# Build type definitions
pnpm --filter @aria/types build

# Build utilities
pnpm --filter @aria/utils build
```

## 🎓 Learning Path

### If You're New to...

#### TypeScript
Start here:
- [TypeScript in 5 Minutes](https://www.typescriptlang.org/docs/handbook/typescript-in-5-minutes.html)
- [Aria Types Package](./packages/types/README.md) - See how we use types

#### React/Next.js
Start here:
- [React Tutorial](https://react.dev/learn)
- [Next.js Tutorial](https://nextjs.org/learn)
- [Asset Frontend README](./apps/frontend/asset/README.md) - See a real example

#### NestJS
Start here:
- [NestJS First Steps](https://docs.nestjs.com/first-steps)
- [Backend README](./apps/backend/README.md) - See our backend structure

#### Monorepos & pnpm
Start here:
- [pnpm Workspaces](https://pnpm.io/workspaces)
- Our [Main README](./README.md) explains the monorepo structure

## 💡 Development Tips

### 1. Use the Right Command

Always use `pnpm --filter <name>` to run commands for specific apps:

```bash
# ✅ Good
pnpm --filter backend test

# ❌ Bad (runs in wrong directory)
cd apps/backend && pnpm test
```

### 2. Leverage Hot Reload

Both backend and frontend support hot reload:
- **Backend**: Automatically restarts when you save files
- **Frontend**: Browser automatically refreshes

### 3. Check Both Terminal and Browser

- **Backend**: Check the terminal for logs and errors
- **Frontend**: Check both terminal AND browser console (F12)

### 4. Install VSCode Extensions

Recommended extensions:
- **ESLint** - Shows code style issues
- **Prettier** - Code formatting
- **TypeScript Vue Plugin** - Better TypeScript support
- **Tailwind CSS IntelliSense** - Tailwind class autocomplete

### 5. Read the Error Messages

TypeScript and ESLint error messages are actually helpful! They tell you:
- What's wrong
- Where it's wrong (file, line, column)
- Often suggest how to fix it

## 🐛 Troubleshooting

### "Cannot find module '@aria/types'"

```bash
# Build the shared packages
pnpm --filter @aria/types build
pnpm --filter @aria/utils build
```

### "Port 3000 is already in use"

Something else is running on that port:

```bash
# Windows: Find and kill the process
netstat -ano | findstr :3000
taskkill /PID <process-id> /F

# Linux/Mac: Find and kill the process
lsof -ti:3000 | xargs kill
```

### "pnpm: command not found"

```bash
# Enable pnpm
corepack enable pnpm

# Or install globally
npm install -g pnpm
```

### Changes Not Showing Up

```bash
# Clear cache and restart
rm -rf node_modules .next dist
pnpm install
pnpm --filter <app-name> dev
```

### TypeScript Errors Everywhere

```bash
# Rebuild shared packages
pnpm build

# Check for errors
pnpm --filter <app-name> exec tsc --noEmit
```

## 📖 Next Steps

### Read the Documentation

1. **[Main README](./README.md)** - Project overview and architecture
2. **[Backend Guide](./apps/backend/README.md)** - API development
3. **[Frontend Guides](./apps/frontend/)** - Web app development
4. **[Types Package](./packages/types/README.md)** - Understanding shared types
5. **[AGENTS.md](./AGENTS.md)** - Development philosophy and best practices

### Explore the Code

1. Look at existing components in `apps/frontend/*/src/components/`
2. Check out the backend modules in `apps/backend/src/modules/`
3. Review shared types in `packages/types/src/`

### Make Your First Contribution

1. Pick a small feature or bug fix
2. Create a new branch
3. Make your changes
4. Run `pnpm format && pnpm lint && pnpm test && pnpm build`
5. Submit a pull request

## 🆘 Getting Help

### Documentation

- Check the README in each directory
- Review the [AGENTS.md](./AGENTS.md) for architectural guidance
- Look at existing code for examples

### Common Issues

- [Troubleshooting Guide](./deployment/docs/TROUBLESHOOTING.md)
- [Backend Issues](./apps/backend/README.md#debugging-tips)
- [Frontend Issues](./apps/frontend/asset/README.md#debugging-tips)

### External Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [pnpm Documentation](https://pnpm.io/)

## 🎉 You're Ready!

You now have everything you need to start developing with Aria ERP. Remember:

- ✅ Read error messages - they're helpful!
- ✅ Use hot reload - saves time
- ✅ Check the docs when stuck
- ✅ Look at existing code for examples
- ✅ Ask questions if confused

Happy coding! 🚀

---

**Pro Tip**: Keep this guide bookmarked - you'll refer to it often when starting out!
